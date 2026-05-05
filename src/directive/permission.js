export default function(app) {
    app.directive('permission', {
      mounted(el, binding) {
        // 传入允许的角色 v-permission="['admin']"
        const needRole = binding.value
        const myRole = localStorage.getItem('role')
        if (!needRole.includes(myRole)) {
          // 没权限直接移除按钮
          el.parentNode.removeChild(el)
        }
      }
    })
  }