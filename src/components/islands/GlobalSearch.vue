<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { SearchEntry } from "../../lib/types";
import { loadIndex, questionHref, TYPE_LABEL } from "../../lib/client/index-data";
import { highlightHtml } from "../../lib/client/highlight";
import { url } from "../../lib/paths";

const props = defineProps<{ totalQ: number }>();

const index = ref<SearchEntry[]>([]);
const query = ref("");

onMounted(async () => {
  index.value = await loadIndex();
  const q0 = new URLSearchParams(location.search).get("q");
  if (q0) query.value = q0;
});

const term = computed(() => query.value.trim().toLowerCase());

const hits = computed(() => {
  if (!term.value) return [];
  const words = term.value.split(/\s+/);
  return index.value.filter((e) => words.every((w) => e.txt.includes(w))).slice(0, 60);
});

const examBanner = computed(() => {
  const m = term.value.match(/^(ss\d\d|ws\d\d|mock)\b/);
  return m ? m[1].toUpperCase() : null;
});

const showResults = computed(() => term.value.length > 0);
const examHref = (code: string) => `${url("/exams")}?e=${code}`;

// Matched search words to highlight in results (see highlightHtml).
const words = computed(() => term.value.split(/\s+/).filter(Boolean));
</script>

<template>
  <div class="gsearch">
    <div class="gsearch-box">
      <svg class="gsearch-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          d="M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z"
        />
      </svg>
      <input
        id="gsearch"
        v-model="query"
        type="search"
        :placeholder="`Search all ${props.totalQ} questions — try “essential matrix”, “SVD”, or “25EDC 1.1”`"
        autocomplete="off"
        aria-label="Search all questions"
      />
    </div>
    <div v-if="showResults" class="gresults">
      <a v-if="examBanner" class="gbanner" :href="examHref(examBanner)">
        📄 Browse all {{ examBanner }} questions →
      </a>
      <template v-if="hits.length">
        <div class="gcount">{{ hits.length }} match{{ hits.length > 1 ? "es" : "" }}</div>
        <a v-for="e in hits" :key="e.a" class="ghit" :href="questionHref(e)">
          <span class="ghit-tag">{{ TYPE_LABEL[e.t] || e.t }}</span>
          <span class="ghit-q" v-html="highlightHtml(e.q, words)"></span>
          <span class="ghit-meta">{{ e.ct }} · {{ e.kp }} · {{ e.src }}</span>
        </a>
      </template>
      <div v-else-if="!examBanner" class="gempty">No questions match “{{ query }}”.</div>
    </div>
  </div>
</template>
