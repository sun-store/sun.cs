<script setup lang="ts">
import { APP_ROLES, type AppRole } from '~~/shared/domain'

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  lead: 'Lead',
  agent: 'Agent (jeszcze nie loguje się)'
}

const { data, refresh, error } = await useFetch('/api/team')
const form = reactive({
  email: '',
  role: 'lead' as AppRole
})
const formError = ref('')
const saving = ref(false)

const roleItems = APP_ROLES.map(value => ({ label: ROLE_LABELS[value], value }))

async function addMember() {
  formError.value = ''
  saving.value = true
  try {
    await $fetch('/api/team', {
      method: 'POST',
      body: { email: form.email, role: form.role }
    })
    form.email = ''
    await refresh()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    formError.value = fetchErr.data?.statusMessage || 'Nie udało się dopisać.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="py-8">
    <h1 class="text-2xl font-semibold tracking-tight">
      Zespół
    </h1>
    <p class="mt-1 text-sm text-muted">
      Tylko osoby z tej listy wejdą do sun.cs. Agentów wpuszczamy w następnym kroku.
    </p>

    <p
      v-if="error"
      class="mt-6 text-sm text-error"
    >
      {{ error.statusMessage || error.message }}
    </p>

    <UCard class="mt-6">
      <table class="w-full text-left text-sm">
        <thead class="text-muted">
          <tr>
            <th class="pb-3 font-medium">
              E-mail
            </th>
            <th class="pb-3 font-medium">
              Rola
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="member in data?.members || []"
            :key="member.email"
            class="border-t border-default"
          >
            <td class="py-3">
              {{ member.email }}
            </td>
            <td>{{ ROLE_LABELS[member.role as AppRole] || member.role }}</td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <UCard class="mt-6 max-w-xl">
      <template #header>
        Dopisz osobę
      </template>
      <form
        class="space-y-3"
        @submit.prevent="addMember"
      >
        <UFormField
          label="Firmowy e-mail"
          required
        >
          <UInput
            v-model="form.email"
            type="email"
            placeholder="imie.nazwisko@sun.store"
          />
        </UFormField>
        <UFormField label="Rola">
          <USelect
            v-model="form.role"
            :items="roleItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <p
          v-if="formError"
          class="text-sm text-error"
        >
          {{ formError }}
        </p>
        <UButton
          type="submit"
          :loading="saving"
          :disabled="!form.email.trim()"
        >
          Dopisz
        </UButton>
      </form>
    </UCard>
  </div>
</template>
