import { supabase } from '@/lib/supabase'

// 1. 获取所有兼职列表 倒序
export const getJobList = async () => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

// 2. 根据ID获取单个兼职详情
export const getJobDetail = async (jobId) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()
  return { data, error }
}

// 3. 发布兼职
export const createJob = async (jobInfo) => {
  const { data, error } = await supabase
    .from('jobs')
    .insert([jobInfo])
  return { data, error }
}

// 4. 获取当前用户发布的兼职
export const getMyJob = async (userId) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return { data, error }
}