<script setup lang="ts">
import { APP_ROLES, type AppRole } from '~~/shared/domain'
import { DEPARTMENTS, DEPARTMENT_LABELS, type Department } from '~~/shared/departments'

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  lead: 'Lead',
  agent: 'Agent'
}

const { data, refresh, error } = await useFetch<{
  members: Array<{ email: string, role: AppRole, department: Department }>
}>('/api/team')

const form = reactive({
  email: '',
  role: 'lead' as AppRole,
  department: 'cs' as Department
})
const formError = ref('')
const saving = ref(false)
const rowError = ref('')
const savingEmail = ref<string | null>(null)

const roleItems = APP_ROLES.map(value => ({ label: ROLE_LABELS[value], value }))
const departmentItems = DEPARTMENTS.map(value => ({ label: DEPARTMENT_LABELS[value], value }))

async function addMember() {
  formError.value = ''
  saving.value = true
  try {
    await $fetch('/api/team', {
      method: 'POST',
      body: {
        email: form.email,
        role: form.role,
        department: form.department
      }
    })
    form.email = ''
    form.department = 'cs'
    await refresh()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    formError.value = fetchErr.data?.statusMessage || 'Nie udało się dopisać.'
  } finally {
    saving.value = false
  }
}

async function saveMemberDepartment(member: { email: string, role: AppRole, department: Department }) {
  rowError.value = ''
  savingEmail.value = member.email
  try {
    await $fetch('/api/team', {
      method: 'POST',
      body: {
        email: member.email,
        role: member.role,
        department: member.department
      }
    })
    await refresh()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string } }
    rowError.value = fetchErr.data?.statusMessage || 'Nie udało się zapisać działu.'
  } finally {
    savingEmail.value = null
  }
}
</script>

<template>
  <div class="py-8">
    <h1 class="text-2xl font-medium tracking-tight">
      Zespół
    </h1>
    <p class="mt-1 text-sm text-muted">
      Tylko osoby z tej listy wejdą do sun.support. Dział ustawia domyślną kolejkę na liście spraw (Support widzi wszystkie).
    </p>

    <p
      v-if="error"
      class="mt-6 text-sm text-error"
    >
      {{ error.statusMessage || error.message }}
    </p>
    <p
      v-if="rowError"
      class="mt-2 text-sm text-error"
    >
      {{ rowError }}
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
            <th class="pb-3 font-medium">
              Dział
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
            <td>{{ ROLE_LABELS[member.role] || member.role }}</td>
            <td class="py-2">
              <USelect
                v-model="member.department"
                :items="departmentItems"
                value-key="value"
                class="w-48"
                :disabled="savingEmail === member.email"
                @update:model-value="saveMemberDepartment(member)"
              />
            </td>
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
        <UFormField label="Dział">
          <USelect
            v-model="form.department"
            :items="departmentItems"
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
