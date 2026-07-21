import { db } from './matu.js';
import { requireProjectId, tenantInsertFields } from '../tenancy/context.js';

function errMsg(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

export interface ForumThread {
  id: string;
  title: string;
  slug: string;
  category: string;
  created_by: string;
  author_name: string;
  status: string;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface ForumPost {
  id: string;
  thread_id: string;
  author_type: 'human' | 'agent';
  author_name: string;
  agent_id: string | null;
  content: string;
  created_at: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

export async function createForumThread(input: {
  title: string;
  content: string;
  category?: string;
  createdBy?: string;
  authorName?: string;
  authorType?: 'human' | 'agent';
  agentId?: string;
}): Promise<ForumThread> {
  const slug = `${slugify(input.title)}-${Date.now().toString(36)}`;
  const tenant = tenantInsertFields();

  const { data, error } = await db.from('forum_threads').insert({
    title: input.title,
    slug,
    category: input.category ?? 'general',
    created_by: input.createdBy ?? 'community',
    author_name: input.authorName ?? 'Anónimo',
    status: 'open',
    ...tenant,
  });
  if (error) throw new Error(`createForumThread: ${errMsg(error)}`);

  const thread = (Array.isArray(data) ? data[0] : data) as ForumThread | undefined;
  if (!thread) throw new Error('createForumThread returned empty');

  const { error: postError } = await db.from('forum_posts').insert({
    thread_id: thread.id,
    author_type: input.authorType ?? 'human',
    author_name: input.authorName ?? 'Anónimo',
    agent_id: input.agentId ?? null,
    content: input.content,
    status: 'published',
    ...tenant,
  });
  if (postError) throw new Error(`createForumThread first post: ${errMsg(postError)}`);

  return thread;
}

export async function createForumPost(input: {
  threadId: string;
  content: string;
  authorType?: 'human' | 'agent';
  authorName?: string;
  agentId?: string;
}): Promise<ForumPost> {
  const { data, error } = await db.from('forum_posts').insert({
    thread_id: input.threadId,
    author_type: input.authorType ?? 'human',
    author_name: input.authorName ?? 'Anónimo',
    agent_id: input.agentId ?? null,
    content: input.content,
    status: 'published',
    ...tenantInsertFields(),
  });
  if (error) throw new Error(`createForumPost: ${errMsg(error)}`);

  await db
    .from('forum_threads')
    .eq('id', input.threadId)
    .update({ updated_at: new Date().toISOString() });

  const post = (Array.isArray(data) ? data[0] : data) as ForumPost | undefined;
  if (!post) throw new Error('createForumPost returned empty');
  return post;
}

export async function listRecentForumThreads(limit = 20): Promise<ForumThread[]> {
  const { data, error } = await db
    .from('forum_threads')
    .select('*')
    .eq('project_id', requireProjectId())
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentForumThreads: ${errMsg(error)}`);
  return (data ?? []) as ForumThread[];
}

export async function listPostsByThread(threadId: string): Promise<ForumPost[]> {
  const { data, error } = await db
    .from('forum_posts')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`listPostsByThread: ${errMsg(error)}`);
  return (data ?? []) as ForumPost[];
}

/**
 * Threads open for an agent reply: no post yet, or the most recent post is human.
 * Fetches threads + posts separately (matuclient has no join support) and merges in JS.
 */
export async function findThreadsNeedingAgentReply(limit = 10): Promise<
  Array<{ thread: ForumThread; posts: ForumPost[] }>
> {
  const threads = await listRecentForumThreads(30);
  if (threads.length === 0) return [];

  const ids = threads.map((t) => t.id);
  const { data, error } = await db
    .from('forum_posts')
    .select('*')
    .in('thread_id', ids)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`findThreadsNeedingAgentReply posts: ${errMsg(error)}`);

  const posts = (data ?? []) as ForumPost[];
  const postsByThread = new Map<string, ForumPost[]>();
  for (const post of posts) {
    const list = postsByThread.get(post.thread_id) ?? [];
    list.push(post);
    postsByThread.set(post.thread_id, list);
  }

  const candidates: Array<{ thread: ForumThread; posts: ForumPost[] }> = [];
  for (const thread of threads) {
    const threadPosts = postsByThread.get(thread.id) ?? [];
    const lastPost = threadPosts[threadPosts.length - 1];
    if (!lastPost || lastPost.author_type === 'human') {
      candidates.push({ thread, posts: threadPosts });
    }
  }

  return candidates.slice(0, limit);
}
