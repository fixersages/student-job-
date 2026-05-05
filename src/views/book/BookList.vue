<template>
  <!-- 页面容器：自动适配PC和手机 -->
  <div class="page-container">
    <!-- 你的页面内容 -->
    <div class="content-wrapper">
      <h2 class="page-title">图书管理系统</h2>
      <!-- 操作栏 -->
      <div class="action-bar">
        <button class="btn btn-primary">新增</button>
        <button class="btn btn-danger" v-permission="['admin']">删除</button>
      </div>
      <!-- 表格/列表 -->
      <div class="card">
        <p>这里是你的内容区域</p >
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 基础布局 */
.page-container {
  width: 100%;
  min-height: 100vh;
  padding: 20px;
}

.content-wrapper {
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 20px;
  color: #303133;
}

/* 按钮美化 */
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 1rem;
  transition: all 0.3s ease;
}
.btn + .btn {
  margin-left: 10px;
}
.btn-primary {
  background-color: #409eff;
  color: #fff;
}
.btn-primary:hover {
  background-color: #66b1ff;
}
.btn-danger {
  background-color: #f56c6c;
  color: #fff;
}
.btn-danger:hover {
  background-color: #f78989;
}

/* 卡片美化 */
.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
  margin-top: 15px;
}

/* 手机适配 */
@media screen and (max-width: 768px) {
  .page-container {
    padding: 12px;
  }
  .page-title {
    font-size: 1.3rem;
  }
  .btn {
    padding: 6px 12px;
    font-size: 0.9rem;
  }
  .action-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .card {
    padding: 15px;
  }
}
</style>

<template>
  <div class="table-container">
    <!-- PC端表格 -->
    <table class="pc-table" border="1" cellpadding="8" cellspacing="0">
      <thead>
        <tr>
          <th>书名</th>
          <th>作者</th>
          <th>价格</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="book in bookList" :key="book.id">
          <td>{{ book.name }}</td>
          <td>{{ book.author }}</td>
          <td>¥{{ book.price }}</td>
          <td>
            <button class="btn btn-edit">编辑</button>
            <button class="btn btn-delete" v-permission="['admin']">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 手机端卡片列表 -->
    <div class="mobile-list">
      <div class="list-item" v-for="book in bookList" :key="book.id">
        <div class="item-title">{{ book.name }}</div>
        <div class="item-info">
          <span>作者：{{ book.author }}</span>
          <span>价格：¥{{ book.price }}</span>
        </div>
        <div class="item-action">
          <button class="btn btn-edit">编辑</button>
          <button class="btn btn-delete" v-permission="['admin']">删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const bookList = ref([
  { id: 1, name: '《Vue3实战》', author: '张三', price: 59 },
  { id: 2, name: '《前端工程化》', author: '李四', price: 69 }
])
</script>

<style scoped>
.pc-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}
.pc-table th {
  background: #f5f7fa;
  font-weight: 500;
}
.pc-table td, .pc-table th {
  text-align: center;
}

.mobile-list {
  display: none;
}

@media screen and (max-width: 768px) {
  .pc-table {
    display: none;
  }
  .mobile-list {
    display: block;
  }
  .list-item {
    background: #fff;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 10px;
  }
  .item-title {
    font-size: 1.1rem;
    font-weight: 500;
    margin-bottom: 8px;
  }
  .item-info {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 10px;
    display: flex;
    gap: 10px;
  }
  .item-action {
    display: flex;
    gap: 8px;
  }
}
</style>