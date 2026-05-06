-- 职位封面图（可选）：列表缩略图、分栏详情 Banner、独立详情页 Banner
-- 与前端 PublishJob「封面图 URL」、utils/jobBanner.js 的 cover_image 字段对应

alter table public.part_time
  add column if not exists cover_image text;

comment on column public.part_time.cover_image is
  '可选 HTTPS 图片地址；为空时前端按职位 id 使用内置配图。';
