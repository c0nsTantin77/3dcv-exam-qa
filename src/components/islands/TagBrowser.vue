<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import type { SearchEntry } from "../../lib/types";
import { loadIndex, questionHref, TYPE_LABEL } from "../../lib/client/index-data";
import { highlightHtml } from "../../lib/client/highlight";
import { url } from "../../lib/paths";
import { slug, buildContents, type ContentsGroup } from "../../lib/client/contents";
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

onMounted(async () => {
  index.value = await loadIndex();
  current.value = new URLSearchParams(location.search).get("t");
  loaded.value = true;
  unsub = onChange(() => version.value++); // reflect reviewed state after sync/import
  await nextTick();
  if (activeTag.value) {
    document.title = activeTag.value + " · Concept tags · 3DCV";
    buildContents(groups.value);
  } else {
    document.title = "Concept tags · 3DCV Exam Q&A";
  }
});
onUnmounted(() => unsub());

const counts = computed(() => {
  const c: Record<string, number> = {};
  index.value.forEach((e) => (e.tg || []).forEach((t) => (c[t] = (c[t] || 0) + 1)));
  return c;
});

const allTags = computed(() =>
  Object.keys(counts.value).sort(
    (a, b) => counts.value[b] - counts.value[a] || a.localeCompare(b),
  ),
);

const activeTag = computed(() =>
  current.value && counts.value[current.value] ? current.value : null,
);

const hits = computed(() =>
  activeTag.value ? index.value.filter((e) => (e.tg || []).includes(activeTag.value!)) : [],
);

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
    if (activeTag.value) buildContents(groups.value);
  },
  { flush: "post" },
);

const tagsUrl = url("/tags");
const tagHref = (t: string) => `${tagsUrl}?t=${encodeURIComponent(t)}`;
</script>

<template>
  <div v-if="!loaded"><p class="hint">Loading…</p></div>

  <div v-else-if="!activeTag">
    <h1 class="tp-title">Concept tags</h1>
    <p class="tp-sub">
      {{ allTags.length }} concepts across {{ index.length }} questions — click a tag to see every
      related question, across all chapters.
    </p>
    <div class="tagcloud">
      <a v-for="t in allTags" :key="t" class="tagbig" :href="tagHref(t)">
        {{ t }}<span class="tagbig-n">{{ counts[t] }}</span>
      </a>
    </div>
  </div>

  <div v-else>
    <a class="tp-back" :href="tagsUrl">← All tags</a>
    <h1 class="tp-title">Tag: <span class="tag">{{ activeTag }}</span></h1>
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
          <span class="ghit-tag">{{ TYPE_LABEL[e.t] || e.t }}</span>
          <span class="ghit-q" v-html="highlightHtml(e.q, fWords)"></span>
          <span class="ghit-meta">{{ e.kp }} · {{ e.src }}<span v-if="isReviewed(e.a)" class="ghit-rev">reviewed</span></span>
        </a>
      </div>
    </template>
  </div>
</template>
