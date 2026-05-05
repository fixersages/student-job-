'use client'
import { supabase } from '@/src/lib/supabase'

export default function TestPage() {

  async function testConnect() {
    // 最简单测试：获取数据库版本
    const { data, error } = await supabase.rpc('version')

    if (error) {
      console.log('❌ 连接失败', error)
      alert('连接失败，检查.env和密钥')
    } else {
      console.log('✅ 连接成功', data)
      alert('✅ Supabase 连接成功！')
    }
  }

  return (
    <div style={{padding:'50px'}}>
      <button onClick={testConnect}>点我测试 Supabase 连接</button>
    </div>
  )
}