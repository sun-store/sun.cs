<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()
const microsoftSso = Boolean(config.public.microsoftSso)
const googleSso = Boolean(config.public.googleSso)
const firmSso = googleSso || microsoftSso

const credentials = reactive({
  email: '',
  password: '',
  name: ''
})
const mode = ref<'signin' | 'signup'>('signin')
const showPassword = ref(!googleSso)
const errorMessage = ref('')
const isSubmitting = ref(false)
const isMicrosoftSubmitting = ref(false)

if (route.query.error) {
  const code = String(route.query.error)
  errorMessage.value = code === 'signup_disabled' || code === 'sso'
    ? 'Użyj firmowego konta @sun.store.'
    : 'Google nie dokończył logowania. Spróbuj jeszcze raz kontem @sun.store.'
}

function safeNext() {
  const raw = route.query.next
  const next = typeof raw === 'string' ? raw : ''
  if (!next.startsWith('/') || next.startsWith('//')) return '/'
  return next
}

async function signInMicrosoft() {
  errorMessage.value = ''
  isMicrosoftSubmitting.value = true
  try {
    const auth = useAuthClient()
    const res = await auth.signIn.social({
      provider: 'microsoft',
      callbackURL: '/auth/sso-complete',
      errorCallbackURL: '/login?error=sso'
    })
    if (res.error) {
      errorMessage.value = res.error.message || 'Nie udało się wejść kontem firmowym.'
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Nie udało się wejść kontem firmowym.'
  } finally {
    isMicrosoftSubmitting.value = false
  }
}

async function signInGoogle() {
  errorMessage.value = ''
  isMicrosoftSubmitting.value = true
  try {
    const auth = useAuthClient()
    const res = await auth.signIn.social({
      provider: 'google',
      callbackURL: '/auth/sso-complete',
      errorCallbackURL: '/login?error=sso'
    })
    if (res.error) {
      errorMessage.value = res.error.message || 'Nie udało się wejść kontem firmowym.'
    }
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Nie udało się wejść kontem firmowym.'
  } finally {
    isMicrosoftSubmitting.value = false
  }
}

async function submit() {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    const auth = useAuthClient()
    const res = await auth.signIn.email({
      email: credentials.email.trim(),
      password: credentials.password
    })
    if (res.error) {
      errorMessage.value = res.error.message === 'Invalid email or password'
        ? 'Nieprawidłowy email lub hasło.'
        : (res.error.message || 'Nie udało się zalogować.')
      return
    }
    await navigateTo(safeNext())
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Nie udało się zalogować.'
  } finally {
    isSubmitting.value = false
  }
}

function toggleMode() {
  mode.value = mode.value === 'signup' ? 'signin' : 'signup'
}

async function signUp() {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    const auth = useAuthClient()
    const res = await auth.signUp.email({
      email: credentials.email.trim(),
      password: credentials.password,
      name: credentials.name.trim() || credentials.email.trim()
    })
    if (res.error) {
      errorMessage.value = res.error.message || 'Nie udało się założyć konta.'
      return
    }
    await navigateTo(safeNext())
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Nie udało się założyć konta.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-[80vh] items-center justify-center">
    <UCard class="w-full max-w-md">
      <template #header>
        <p class="text-sm text-muted">
          Customer Support
        </p>
        <h1 class="text-xl font-semibold">
          sun.cs
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{ firmSso ? 'Wejdź kontem firmowym @sun.store — tak samo jak w logistics.' : 'Wejdź adresem @sun.store. Musisz być na liście zespołu.' }}
        </p>
      </template>

      <div class="space-y-4">
        <UButton
          v-if="googleSso"
          block
          size="lg"
          :loading="isMicrosoftSubmitting"
          @click="signInGoogle"
        >
          Zaloguj kontem firmowym
        </UButton>
        <UButton
          v-else-if="microsoftSso"
          block
          size="lg"
          :loading="isMicrosoftSubmitting"
          @click="signInMicrosoft"
        >
          Zaloguj kontem firmowym
        </UButton>

        <p
          v-if="errorMessage"
          class="text-sm text-error"
        >
          {{ errorMessage }}
        </p>

        <UButton
          v-if="firmSso"
          variant="link"
          color="neutral"
          @click="showPassword = !showPassword"
        >
          {{ showPassword ? 'Ukryj hasło' : 'Wejdź e-mailem i hasłem' }}
        </UButton>

        <form
          v-if="showPassword"
          class="space-y-4"
          @submit.prevent="mode === 'signup' ? signUp() : submit()"
        >
          <UFormField
            v-if="mode === 'signup'"
            label="Imię"
          >
            <UInput
              v-model="credentials.name"
              autocomplete="name"
            />
          </UFormField>
          <UFormField label="Firmowy e-mail">
            <UInput
              v-model="credentials.email"
              type="email"
              autocomplete="username"
              placeholder="imie.nazwisko@sun.store"
            />
          </UFormField>
          <UFormField label="Hasło">
            <UInput
              v-model="credentials.password"
              type="password"
              :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
            />
          </UFormField>
          <UButton
            type="submit"
            block
            color="neutral"
            variant="subtle"
            :loading="isSubmitting"
          >
            {{ mode === 'signup' ? 'Załóż hasło i wejdź' : 'Zaloguj hasłem' }}
          </UButton>
        </form>
        <button
          v-if="showPassword"
          type="button"
          class="text-sm text-muted underline"
          @click="toggleMode"
        >
          {{ mode === 'signup' ? 'Mam już hasło' : 'Pierwsze wejście — załóż hasło' }}
        </button>
      </div>
    </UCard>
  </div>
</template>
