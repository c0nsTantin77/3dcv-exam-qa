<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { SearchEntry } from "../../lib/types";
import { loadIndex, questionHref } from "../../lib/client/index-data";
import { highlightHtml } from "../../lib/client/highlight";
import { url } from "../../lib/paths";
import { slug, buildContents, type ContentsGroup } from "../../lib/client/contents";
import { EXAM_NAMES, examOf, labelOf } from "../../lib/exams";
import { Store, onChange } from "../../lib/client/store";

const index = ref<SearchEntry[]>([]);
const loaded = ref(false);
const current = ref<string | null>(null);
const filter = ref("");
const fWords = computed(() => filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean));

// reviewed marker on each listed question (reads the shared study store)
const version = ref(0);
let unsub = () => {};
function isReviewed(a: string): boolean {
  void version.value;
  return Store.isReviewed(a);
}

const counts = computed(() => {
  const c: Record<string, number> = {};
  index.value.forEach((e) => {
    const seen = new Set<string>();
    (e.srcs || []).forEach((s) => {
      const x = examOf(s);
      if (x && !seen.has(x)) {
        seen.add(x);
        c[x] = (c[x] || 0) + 1;
      }
    });
  });
  return c;
});

const activeExam = computed(() =>
  current.value && counts.value[current.value] ? current.value : null,
);

const hits = computed(() => {
  if (!activeExam.value) return [];
  const ex = activeExam.value;
  const list = index.value.filter((e) => (e.srcs || []).some((s) => examOf(s) === ex));
  const num = (e: SearchEntry) => {
    const s = (e.srcs || []).find((x) => examOf(x) === ex) || "";
    const m = labelOf(s).match(/(\d+)\.?(\d+)?/);
    return m ? parseInt(m[1]) * 100 + parseInt(m[2] || "0") : 9999;
  };
  return [...list].sort((a, b) => num(a) - num(b));
});

interface Group extends ContentsGroup {
  entries: SearchEntry[];
}
const byChapter = computed<Group[]>(() => {
  const ws = fWords.value;
  const map = new Map<string, SearchEntry[]>();
  hits.value.forEach((e) => {
    if (ws.length && !ws.every((w) => e.txt.includes(w))) return;
    if (!map.has(e.ct)) map.set(e.ct, []);
    map.get(e.ct)!.push(e);
  });
  return [...map.entries()].map(([ct, entries]) => ({
    id: "sec-" + slug(ct),
    title: ct,
    n: entries.length,
    entries,
  }));
});
const groups = computed<ContentsGroup[]>(() =>
  byChapter.value.map((g) => ({ id: g.id, title: g.title, n: g.n })),
);
const shownCount = computed(() => byChapter.value.reduce((n, g) => n + g.entries.length, 0));

// keep the topbar contents pill in sync when filtering changes the sections
watch(
  () => groups.value.map((g) => g.id).join("|"),
  () => {
    if (activeExam.value) buildContents(groups.value);
  },
  { flush: "post" },
);

const examName = computed(() =>
  activeExam.value ? EXAM_NAMES[activeExam.value] ?? activeExam.value : "",
);

const tagFor = (e: SearchEntry) => {
  const ex = activeExam.value!;
  const lbl = (e.srcs || [])
    .filter((s) => examOf(s) === ex)
    .map(labelOf)
    .join(", ");
  return `${ex} ${lbl}`;
};

onMounted(async () => {
  index.value = await loadIndex();
  current.value = new URLSearchParams(location.search).get("e");
  if (!activeExam.value) {
    // bare exams page is redundant with the homepage "By exam" view
    location.replace(url("/") + "#by-exam");
    return;
  }
  loaded.value = true;
  unsub = onChange(() => version.value++); // reflect reviewed state after sync/import
  document.title = activeExam.value + " · Browse by exam · 3DCV";
  await nextTick();
  buildContents(groups.value);
});
onUnmounted(() => unsub());
</script>

<template>
  <div v-if="!loaded"><p class="hint">Loading…</p></div>
  <div v-else>
    <h1 class="tp-title">{{ examName }} <span class="tag">{{ activeExam }}</span></h1>
    <p class="tp-sub">
      {{ shownCount }} question{{ shownCount === 1 ? "" : "s" }}<template v-if="filter.trim()"> of
        {{ hits.length }}</template>
      across {{ byChapter.length }} chapter{{ byChapter.length === 1 ? "" : "s" }}.
    </p>
    <Teleport to="#tp-filter-slot">
      <input
        v-model="filter"
        class="tp-search"
        type="search"
        :placeholder="`Filter these ${hits.length} questions…`"
        aria-label="Filter questions"
      />
    </Teleport>
    <p v-if="!byChapter.length" class="tp-empty">No questions match “{{ filter }}”.</p>
    <template v-for="g in byChapter" :key="g.id">
      <h2 class="tp-ch" :id="g.id">{{ g.title }}</h2>
      <div class="tp-list">
        <a v-for="e in g.entries" :key="e.a" class="ghit"
          :class="{ 'is-reviewed': isReviewed(e.a) }" :href="questionHref(e)">
          <span class="ghit-tag">{{ tagFor(e) }}</span>
          <span class="ghit-q" v-html="highlightHtml(e.q, fWords)"></span>
          <span class="ghit-meta">{{ e.kp }}<span v-if="isReviewed(e.a)" class="ghit-rev">reviewed</span></span>
        </a>
      </div>
    </template>
  </div>
</template>
