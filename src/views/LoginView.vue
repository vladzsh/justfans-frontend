<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ApiError } from '@/services/api'

const authStore = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    await authStore.login(username.value, password.value)
    const target = authStore.user?.role === 'chatter' ? '/chat' : '/monitor'
    router.push(target)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      error.value = 'Неверный логин или пароль'
    } else {
      error.value = 'Ошибка входа. Попробуйте снова.'
    }
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="login-content">
      <h1 class="login-bg-title">JustFans CRM</h1>
      
      <form class="login-box" @submit.prevent="submit">
        <div class="field">
          <label for="username">Логин</label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="chatter1"
            required
          />
        </div>

        <div class="field">
          <label for="password">Пароль</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            required
          />
        </div>

        <p v-if="error" class="login-error">{{ error }}</p>

        <button type="submit" class="btn-primary" :disabled="authStore.loading">
          {{ authStore.loading ? 'Вход...' : 'Войти' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100%;
  margin: 0;
  background-color: #0e0e11;
  background-image: 
    radial-gradient(
      circle at center, 
      rgba(46, 59, 138, 0.18) 0%, 
      rgba(14, 14, 17, 0) 60%
    ),
    radial-gradient(
      circle at center, 
      rgba(30, 31, 64, 0.5) 0%, 
      #0e0e11 100%
    );
  background-attachment: fixed;
}

.login-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2.5rem;
  width: 100%;
  max-width: 400px;
}

.login-bg-title {
  font-size: 2.5rem;
  font-weight: 500;
  color: #e3e3e3;
  margin: 0;
  letter-spacing: -0.02em;
}

.login-box {
  background: rgba(30, 31, 36, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 2.5rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field label {
  font-size: 0.95rem;
  text-align: center;
  color: #b0b0b0;
}

.field input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  color: #fff;
  outline: none;
  transition: all 0.2s;
}

.field input:focus {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
}

.login-error {
  color: #ff6b6b;
  font-size: 0.875rem;
}

.btn-primary {
  background: #4a86ff;
  color: #fff;
  font-weight: 600;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  transition: transform 0.15s, background 0.15s;
  margin-top: 0.5rem;
}

.btn-primary:hover:not(:disabled) {
  background: #6296ff;
  transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
