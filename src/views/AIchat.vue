<template>
  <div class="chat-container">
    <h2>AI 对话助手</h2>

    <!-- 输入框 -->
    <textarea
      v-model="userInput"
      placeholder="请输入你的问题..."
      rows="4"
      class="input-box"
    ></textarea>

    <!-- 发送按钮 -->
    <button @click="sendToAI" :disabled="loading" class="send-btn">
      {{ loading ? "思考中..." : "发送给AI" }}
    </button>

    <!-- AI 回复区域 -->
    <div v-if="aiReply" class="reply-box">
      <h4>AI回复：</h4>
      <p>{{ aiReply }}</p >
    </div>
  </div>...