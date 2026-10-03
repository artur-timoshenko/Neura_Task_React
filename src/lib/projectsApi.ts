import { supabase } from '@/integrations/supabase/client';
import type { Project } from './projectTree';
async function request(path: string, method = 'GET', body?: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Требуется вход');
  const response = await fetch('/api/projects' + path, {
    method, headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Не удалось сохранить проект');
  return result;
}
export const loadProjects = (): Promise<Project[]> => request('');
export async function saveProjects(next: Project[], previous: Project[]): Promise<Project[]> {
  const result = [...next];
  for (const project of next) {
    const old = previous.find(p => p.id === project.id);
    if (JSON.stringify(old) === JSON.stringify(project)) continue;
    const saved = await request(old ? '/' + project.id : '', old ? 'PUT' : 'POST', project);
    result[result.findIndex(p => p.id === project.id)] = saved;
  }
  for (const old of previous) if (!next.some(p => p.id === old.id)) {
    await request('/' + old.id, 'DELETE', { _version: old._version });
  }
  return result;
}
