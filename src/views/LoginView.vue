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
    <form class="login-box" @submit.prevent="submit">
      <h1 class="login-title">JustFans CRM</h1>
      <p class="login-sub">Рабочее место чатера</p>

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
</template>

<style scoped>
.login-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg-primary);
}

.login-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2rem;
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.login-sub {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: -0.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.field input {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
}

.field input:focus {
  border-color: var(--accent);
}

.login-error {
  color: var(--danger);
  font-size: 0.875rem;
}

.btn-primary {
  background: var(--accent);
  color: #0d1117;
  font-weight: 600;
  padding: 0.625rem 1rem;
  border-radius: 6px;
  transition: background 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
