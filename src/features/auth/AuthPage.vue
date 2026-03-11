<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import Input from "@/components/ui/Input.vue";
import { useAuthStore } from "@/stores/auth-store";

const authStore = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const isCreatingAccount = ref(true);

const submit = async (): Promise<void> => {
  const trimmedEmail = email.value.trim();
  if (!trimmedEmail || !password.value.trim()) {
    authStore.errorMessage = "Email and password are required.";
    return;
  }

  if (isCreatingAccount.value) {
    await authStore.signUp(trimmedEmail, password.value);
  } else {
    await authStore.signIn(trimmedEmail, password.value);
  }

  if (authStore.isAuthenticated) {
    await router.replace({ name: "today" });
  }
};

const continueWithGoogle = async (): Promise<void> => {
  await authStore.signInWithGoogle();
};
</script>

<template>
  <div class="app-root feature feature-auth flex min-h-screen items-center justify-center px-3 py-8 sm:px-4 sm:py-12">
    <Card class="w-full max-w-md p-4 sm:p-6">
      <div class="space-y-2 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Nutrition Assistant</p>
        <h1 class="text-3xl font-semibold tracking-tight">EZHA</h1>
        <p class="text-sm text-muted-foreground">
          Smarter meal logging with AI estimates you can edit.
        </p>
      </div>

      <div class="ios-segment mt-6 grid grid-cols-2">
        <button
          class="rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
          :class="
            isCreatingAccount
              ? 'bg-card text-foreground shadow-[0_8px_20px_rgb(15_23_42_/_0.12)]'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="isCreatingAccount = true"
        >
          Create
        </button>
        <button
          class="rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
          :class="
            !isCreatingAccount
              ? 'bg-card text-foreground shadow-[0_8px_20px_rgb(15_23_42_/_0.12)]'
              : 'text-muted-foreground hover:text-foreground'
          "
          @click="isCreatingAccount = false"
        >
          Log in
        </button>
      </div>

      <form class="mt-5 space-y-3" @submit.prevent="submit">
        <Input v-model="email" type="email" placeholder="Email" />
        <Input v-model="password" type="password" placeholder="Password" />

        <p v-if="authStore.errorMessage" class="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {{ authStore.errorMessage }}
        </p>

        <Button type="submit" class="w-full" :loading="authStore.isLoading">
          {{ isCreatingAccount ? "Create account" : "Log in" }}
        </Button>
      </form>

      <Button
        variant="outline"
        class="mt-3 w-full"
        :disabled="authStore.isLoading"
        @click="continueWithGoogle"
      >
        Continue with Google
      </Button>
    </Card>
  </div>
</template>
