<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useMessage } from "naive-ui";
import { setApiKey, hasApiKey } from "@/api/client";
import { loginWithExternalPlatform } from "@/api/auth";
import { sm2Encrypt } from "@/utils/sm2crypto";
import { useUserStore } from "@/stores/hermes/user";

const { t } = useI18n();
const message = useMessage();
const router = useRouter();
const userStore = useUserStore();

const username = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");
const showLockResetHint = ref(false);

// If already has a key, try to go to main page
if (hasApiKey()) {
  router.replace("/hermes/chat");
}

onMounted(async () => {
  // Clear manual-logout flag so future refreshes don't block auto-login
  sessionStorage.removeItem('hermes_manual_logout')
  try {
    // await fetchAuthStatus();
  } catch {
    // Login remains available; the submit request will surface connection errors.
  }
});

/**
 * Mapairs 平台登录（统一登录）：SM2 加密密码 → 调 external-login → 返回 Hermes JWT
 */
async function handleLogin() {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = t("login.credentialsRequired");
    return;
  }

  loading.value = true;
  errorMsg.value = "";
  showLockResetHint.value = false;

  try {
    // SM2 加密密码（前端加密）
    const encryptedPassword = sm2Encrypt(password.value);
    if (!encryptedPassword) {
      errorMsg.value = "密码加密失败，请重试";
      return;
    }

    const result = await loginWithExternalPlatform(
      username.value.trim(),
      encryptedPassword,
      password.value,
    );

    // 存储 Hermes JWT 和平台用户信息
    setApiKey(result.token);
    userStore.setLogin(result.token, result.userInfo);

    router.replace("/hermes/chat");
  } catch (err: any) {
    if (err.status === 429 || err.status === 503) {
      errorMsg.value = t("login.tooManyAttempts");
      showLockResetHint.value = true;
    } else {
      // Backend may return i18n keys (e.g. login.invalidCredentials) for localized errors
      const msg = err.message || ""
      errorMsg.value = msg.includes('.') ? t(msg) : (err.message || t("login.invalidCredentials"))
    }
  } finally {
    loading.value = false;
  }
}

/** 「无法登录？联系管理员」帮助入口 */
function handleContactAdmin() {
  message.info("联系平台管理员获取账号");
}
</script>

<template>
  <div class="login-view">
    <div class="login-card">
      <!-- Logo -->
      <div class="login-logo">
        <div class="logo-wrap">
          <img src="/logo.png" alt="UniEcoClaw" />
        </div>
      </div>
      <h1 class="login-title">UniEcoClaw 登录</h1>

      <!-- 平台登录提示徽章 -->
      <div class="login-platform-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
        </svg>
        数智大气平台 统一登录
      </div>

      <!-- 登录表单（平台账号登录） -->
      <form class="login-form" @submit.prevent="handleLogin">
        <!-- 账号输入 -->
        <div class="login-input-wrap">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <input v-model="username" type="text" class="login-input" placeholder="请输入账号" autofocus />
        </div>

        <!-- 密码输入 -->
        <div class="login-input-wrap">
          <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <input v-model="password" type="password" class="login-input" placeholder="请输入密码" />
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMsg" class="login-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{{ errorMsg }}</span>
        </div>

        <!-- 锁定提示 -->
        <div v-if="showLockResetHint" class="login-lock-hint">
          <span>{{ t("login.lockResetHint") }}</span>
          <code>hermes-web-ui clear-login-locks --restart</code>
        </div>

        <!-- 提交按钮 -->
        <button type="submit" class="login-btn" :disabled="loading">
          <span v-if="loading" class="loading">
            <span class="spinner"></span>登录中...
          </span>
          <span v-else>登 录</span>
        </button>
      </form>

      <!-- 底部帮助 -->
      <div class="login-foot">
        <span>© 2026 UniEcoClaw</span>
        <a href="#" @click.prevent="handleContactAdmin">无法登录？联系管理员</a>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.login-view {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-primary;
  padding: 20px;
  box-sizing: border-box;
}

.login-card {
  width: 480px;
  max-width: calc(100vw - 32px);
  padding: 56px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);

  @media (max-width: 520px) {
    padding: 32px 24px;
  }
}

.login-logo {
  margin-bottom: 24px;
  display: flex;
  justify-content: center;

  .logo-wrap {
    width: 80px;
    height: 80px;
    border-radius: $radius-md;
    background: #fff;
    border: 1px solid $border-color;
    display: grid;
    place-items: center;
    overflow: hidden;

    img {
      width: 68px;
      height: 68px;
      object-fit: contain;
    }
  }
}

.login-title {
  font-size: 26px;
  font-weight: 600;
  color: $text-primary;
  margin: 0 0 16px;
  letter-spacing: 0.2px;

  @media (max-width: 520px) {
    font-size: 22px;
  }
}

/* 平台品牌标签（替代原来的 tab 切换） */
.login-platform-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  margin-bottom: 28px;
  border-radius: 24px;
  background: rgba(var(--accent-primary-rgb), 0.08);
  color: $accent-primary;
  font-size: 12.5px;
  font-weight: 500;

  svg {
    width: 14px;
    height: 14px;
  }
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: left;
}

.login-input-wrap {
  position: relative;

  .input-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: $text-muted;
  }

  .login-input {
    padding-left: 42px;
  }
}

.login-input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  font-size: 15px;
  color: $text-primary;
  background: $bg-input;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
  font-family: $font-ui;

  &::placeholder {
    color: $text-muted;
  }

  &:focus {
    border-color: $accent-primary;
    box-shadow: 0 0 0 3px rgba(var(--accent-primary-rgb), 0.08);
  }
}

/* 错误提示条 */
.login-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(var(--error-rgb), 0.06);
  border: 1px solid rgba(var(--error-rgb), 0.25);
  border-radius: $radius-sm;
  font-size: 12.5px;
  color: $error;
  line-height: 1.5;

  svg {
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    margin-top: 1px;
  }
}

/* 锁定/重置提示 */
.login-lock-hint {
  padding: 10px 12px;
  border: 1px solid rgba(var(--warning-rgb), 0.35);
  border-radius: $radius-sm;
  background: rgba(var(--warning-rgb), 0.08);
  color: $text-secondary;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;

  code {
    display: block;
    margin-top: 4px;
    color: $text-primary;
    font-family: $font-code;
    word-break: break-all;
    background: rgba(var(--warning-rgb), 0.06);
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11.5px;
  }
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: $radius-sm;
  background: $accent-primary;
  color: var(--text-on-accent);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  font-family: $font-ui;
  letter-spacing: 0.5px;

  &:hover:not(:disabled) {
    background: $accent-hover;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 底部帮助链接 */
.login-foot {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid $border-light;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: $text-muted;

  a {
    color: $accent-primary;
    text-decoration: none;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
