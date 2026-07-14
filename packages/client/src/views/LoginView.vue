<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { setApiKey, hasApiKey } from "@/api/client";
import {
  fetchAuthStatus,
  loginWithPassword,
  loginWithExternalPlatform,
} from "@/api/auth";
import { sm2Encrypt } from "@/utils/sm2crypto";
import { useUserStore } from "@/stores/hermes/user";

const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();

type LoginMode = "platform" | "local";
const loginMode = ref<LoginMode>("platform");   // 默认平台登录

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

async function handleLogin() {
  if (loginMode.value === "platform") {
    await handlePlatformLogin();
  } else {
    await handlePasswordLogin();
  }
}

/**
 * Mapairs 平台登录：SM2 加密密码 → 调 external-login → 返回 Hermes JWT
 */
async function handlePlatformLogin() {
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

/**
 * 本地密码登录（保留，作为管理员兜底）
 */
async function handlePasswordLogin() {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = t("login.credentialsRequired");
    return;
  }

  loading.value = true;
  errorMsg.value = "";
  showLockResetHint.value = false;

  try {
    const sessionToken = await loginWithPassword(username.value.trim(), password.value);
    setApiKey(sessionToken);
    router.replace("/hermes/chat");
  } catch (err: any) {
    if (err.status === 429 || err.status === 503) {
      errorMsg.value = t("login.tooManyAttempts");
      showLockResetHint.value = true;
    } else {
      errorMsg.value = err.message || t("login.invalidCredentials");
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-view">
    <div class="login-card">
      <div class="login-logo">
        <img src="/logo.png" alt="Hermes" width="80" height="80" />
      </div>
      <h1 class="login-title">{{ t("login.title") }}</h1>

      <!-- 登录模式切换 -->
      <div class="login-tabs">
        <button class="login-tab" :class="{ active: loginMode === 'platform' }" @click="loginMode = 'platform'">
          平台账号登录
        </button>
        <button class="login-tab" :class="{ active: loginMode === 'local' }" @click="loginMode = 'local'">
          本地账号登录
        </button>
      </div>

      <!-- 平台登录表单（主入口） -->
      <form v-if="loginMode === 'platform'" class="login-form" @submit.prevent="handleLogin">
        <input v-model="username" type="text" class="login-input" placeholder="请输入 Mapairs 平台账号" autofocus />
        <input v-model="password" type="password" class="login-input" placeholder="请输入平台密码"
          @keyup.enter="handleLogin" />
        <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>
        <div v-if="showLockResetHint" class="login-lock-hint">
          <span>{{ t("login.lockResetHint") }}</span>
          <code>hermes-web-ui clear-login-locks --restart</code>
          <span>{{ t("login.defaultLoginResetHint") }}</span>
          <code>hermes-web-ui reset-default-login</code>
        </div>
        <button type="submit" class="login-btn" :disabled="loading" @click="handleLogin">
          {{ loading ? "..." : t("login.submit") }}
        </button>
      </form>

      <!-- 本地登录表单（备用） -->
      <form v-else class="login-form" @submit.prevent="handleLogin">
        <input v-model="username" type="text" class="login-input" :placeholder="t('login.usernamePlaceholder')"
          autofocus />
        <input v-model="password" type="password" class="login-input" :placeholder="t('login.passwordPlaceholder')"
          @keyup.enter="handleLogin" />
        <p class="login-default-hint">{{ t("login.defaultCredentialsHint") }}</p>
        <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>
        <div v-if="showLockResetHint" class="login-lock-hint">
          <span>{{ t("login.lockResetHint") }}</span>
          <code>hermes-web-ui clear-login-locks --restart</code>
          <span>{{ t("login.defaultLoginResetHint") }}</span>
          <code>hermes-web-ui reset-default-login</code>
        </div>
        <button type="submit" class="login-btn" :disabled="loading" @click="handleLogin">
          {{ loading ? "..." : t("login.submit") }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.login-view {
  height: calc(100 * var(--vh));
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-primary;
}

.login-card {
  width: 480px;
  max-width: calc(100vw - 32px);
  padding: 56px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  text-align: center;

  @media (max-width: $breakpoint-mobile) {
    padding: 32px 24px;
  }
}

.login-logo {
  margin-bottom: 24px;
}

.login-title {
  font-size: 26px;
  font-weight: 600;
  color: $text-primary;
  margin: 0 0 16px;
}

/* 登录模式切换标签 */
.login-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.login-tab {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $bg-input;
  color: $text-muted;
  font-size: 13px;
  cursor: pointer;
  transition: all $transition-fast;

  &.active {
    background: $accent-primary;
    color: var(--text-on-accent);
    border-color: $accent-primary;
  }

  &:hover:not(.active) {
    border-color: $accent-primary;
    color: $text-primary;
  }
}

/* 本地登录提示（仅本地模式显示） */
.login-default-hint {
  margin: 0 0 28px;
  font-family: $font-code;
  font-size: 13px;
  color: $text-secondary;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  transition: border-color $transition-fast;
  box-sizing: border-box;
  font-family: $font-code;

  &::placeholder {
    color: $text-muted;
  }

  &:focus {
    border-color: $accent-primary;
  }
}

.login-error {
  font-size: 13px;
  color: $error;
  text-align: left;
  margin-bottom: 8px;
}

.login-lock-hint {
  padding: 10px 12px;
  border: 1px solid rgba(var(--warning-rgb), 0.35);
  border-radius: $radius-sm;
  background: rgba(var(--warning-rgb), 0.08);
  color: $text-secondary;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;
  margin-bottom: 8px;

  code {
    display: block;
    margin-top: 4px;
    color: $text-primary;
    font-family: $font-code;
    word-break: break-all;
  }
}

.login-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: $radius-sm;
  background: $text-primary;
  color: var(--text-on-accent);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity $transition-fast;

  &:hover {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
