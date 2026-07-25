<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { SearchEntry } from "../../lib/types";
import { loadIndex, questionHref, TYPE_LABEL } from "../../lib/client/index-data";
import { Store, onChange } from "../../lib/client/store";
import FlashcardDeck from "./FlashcardDeck.vue";

const index = ref<SearchEntry[]>([]);
const loaded = ref(false);
const version = ref(0); // bumped to recompute when the store changes

const byId = computed(() => {
  const m: Record<string, SearchEntry> = {};
  index.value.forEach((e) => (m[e.a] = e));
  return m;
});

interface Group {
  c: string;
  ct: string;
  items: SearchEntry[];
}

/** Group entries by chapter, preserving the index's syllabus order. */
function groupByChapter(entries: SearchEntry[]): Group[] {
  const map = new Map<string, Group>();
  for (const e of entries) {
    let g = map.get(e.c);
    if (!g) {
      g = { c: e.c, ct: e.ct, items: [] };
      map.set(e.c, g);
    }
    g.items.push(e);
  }
  return [...map.values()];
}

const dueGroups = computed(() => {
  void version.value;
  const due = Store.dueList(Object.keys(byId.value))
    .map((id) => byId.value[id])
    .filter(Boolean);
  return groupByChapter(due);
});
const dueCount = computed(() => dueGroups.value.reduce((n, g) => n + g.items.length, 0));

const wrongGroups = computed(() => {
  void version.value;
  const w = Store.wrongIds()
    .map((id) => byId.value[id])
    .filter(Boolean);
  return groupByChapter(w);
});
const wrongCount = computed(() => wrongGroups.value.reduce((n, g) => n + g.items.length, 0));

// per-chapter reviewed progress, for the ring (mirrors the home-page rings)
const chapterTotals = computed(() => {
  const t: Record<string, number> = {};
  index.value.forEach((e) => (t[e.c] = (t[e.c] || 0) + 1));
  return t;
});
function ringPct(c: string): number {
  void version.value;
  const tot = chapterTotals.value[c] || 0;
  if (!tot) return 0;
  const done = index.value.filter((e) => e.c === c && Store.isReviewed(e.a)).length;
  return Math.round((100 * done) / tot);
}
const R = 16;
const CIRC = 2 * Math.PI * R;
const ringOffset = (pct: number): number => CIRC * (1 - pct / 100);

function dueLabel(id: string): string {
  void version.value;
  const d = Store.due(id);
  if (!d) return "";
  return d <= new Date().toISOString().slice(0, 10) ? "due now" : "next " + d;
}

function markReviewed(id: string): void {
  Store.setReviewed(id, true);
  version.value++;
}
function removeWrong(id: string): void {
  Store.setWrong(id, false);
  version.value++;
}

// ---- flashcard launcher ----
const fcQueue = ref<string[] | null>(null);
const fcLabel = ref("");
const allCount = computed(() => index.value.length);
const dueIds = computed(() => {
  void version.value;
  return Store.dueList(Object.keys(byId.value));
});
const wrongIds = computed(() => {
  void version.value;
  return Store.wrongIds().filter((id) => byId.value[id]);
});
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function startFc(scope: "due" | "wrong" | "all"): void {
  if (scope === "due") {
    fcQueue.value = dueIds.value;
    fcLabel.value = "Due flashcards";
  } else if (scope === "wrong") {
    fcQueue.value = wrongIds.value;
    fcLabel.value = "Wrong-book flashcards";
  } else {
    fcQueue.value = shuffle(Object.keys(byId.value));
    fcLabel.value = "All (shuffled)";
  }
}
function closeFc(): void {
  fcQueue.value = null;
  version.value++;
}

let unsub = () => {};
onMounted(async () => {
  index.value = await loadIndex();
  loaded.value = true;
  unsub = onChange(() => version.value++); // import / cloud merge → refresh
});
onUnmounted(() => unsub());
</script>

<template>
  <div v-if="!loaded"><p class="hint">Loading…</p></div>
  <div v-else>
    <h1 class="tp-title">Review</h1>
    <p class="tp-sub">
      Your spaced-repetition queue and wrong book — saved in this browser (and synced if you sign in).
    </p>

    <nav class="rv-jump" aria-label="Jump to section">
      <a href="#rv-flashcards" class="rv-jump-pill">🃏 Flashcards</a>
      <a href="#rv-due" class="rv-jump-pill">🧠 Due today</a>
      <a href="#rv-wrong" class="rv-jump-pill">★ Wrong book</a>
    </nav>

    <details class="rv-explain">
      <summary><span class="rv-explain-ico">ⓘ</span> How review works</summary>
      <ul>
        <li>
          <b>🃏 Flashcards</b> — study a deck (today’s <b>due</b>, your <b>wrong book</b>, or
          <b>all</b>) and rate each card <i>Again / Hard / Good / Easy</i>; spaced repetition (SM-2)
          sets when it comes back.
        </li>
        <li>
          <b>Due today</b> = cards whose scheduled date has arrived. <b>Wrong book</b> = questions
          you missed, kept until you remove them.
        </li>
        <li>
          On a question, tick <b>Reviewed</b> to schedule it, or tap its red <b>“Review due”</b> pill
          <i>(only when it's actually due)</i> to mark it done — each review pushes the next date out
          further: <b>1 → 2 → 4 → 7 → 15 → 30 → 60 days</b>. A future “next review …” pill is just info.
        </li>
        <li>Pushed a card too far? <b>Untick Reviewed</b> to clear its schedule, then re-tick to start over.</li>
      </ul>
    </details>

    <section class="fc-launch" id="rv-flashcards">
      <div class="fc-launch-txt">
        <b>🃏 Flashcards</b>
        <span>Anki-style: rate each card <i>Again / Hard / Good / Easy</i> and it reschedules itself (SM-2).</span>
      </div>
      <div class="fc-launch-btns">
        <button class="fc-start primary" :disabled="!dueCount" @click="startFc('due')">
          Study due ({{ dueCount }})
        </button>
        <button class="fc-start" :disabled="!wrongCount" @click="startFc('wrong')">
          Wrong book ({{ wrongCount }})
        </button>
        <button class="fc-start ghost" @click="startFc('all')">
          All {{ allCount }} questions (shuffled)
        </button>
      </div>
    </section>

    <section class="rv-section" id="rv-due">
      <h2 class="rv-h rv-h-due">🧠 Due today <span class="rv-cnt">{{ dueCount }}</span></h2>
      <p v-if="!dueCount" class="tp-empty">Nothing due — mark questions “Reviewed” to schedule them.</p>
      <details v-for="g in dueGroups" :key="'d-' + g.c" class="rv-group" open>
        <summary class="rv-group-head">
          <svg class="rv-ring" viewBox="0 0 40 40" aria-hidden="true">
            <circle class="rv-ring-bg" cx="20" cy="20" :r="R" />
            <circle
              class="rv-ring-fg"
              cx="20"
              cy="20"
              :r="R"
              :style="{ strokeDasharray: CIRC, strokeDashoffset: ringOffset(ringPct(g.c)) }" />
            <text x="20" y="21" class="rv-ring-txt">{{ ringPct(g.c) }}</text>
          </svg>
          <span class="rv-group-title">{{ g.ct }}</span>
          <span class="rv-group-n">{{ g.items.length }} due</span>
        </summary>
        <div class="tp-list">
          <div v-for="e in g.items" :key="e.a" class="ghit ghit-row">
            <a class="ghit-main" :href="questionHref(e)">
              <span class="ghit-tag">{{ TYPE_LABEL[e.t] || e.t }}</span>
              <span class="ghit-q">{{ e.q }}</span>
              <span class="ghit-meta">{{ e.kp }} · {{ e.src }}</span>
            </a>
            <button class="io-btn rev-now" @click="markReviewed(e.a)">✓ Reviewed</button>
          </div>
        </div>
      </details>
    </section>

    <section class="rv-section" id="rv-wrong">
      <h2 class="rv-h rv-h-wrong">★ Wrong book <span class="rv-cnt">{{ wrongCount }}</span></h2>
      <p v-if="!wrongCount" class="tp-empty">
        Empty — multiple-choice you answer wrong, or “Missed” on a short answer, lands here automatically.
      </p>
      <details v-for="g in wrongGroups" :key="'w-' + g.c" class="rv-group" open>
        <summary class="rv-group-head">
          <svg class="rv-ring" viewBox="0 0 40 40" aria-hidden="true">
            <circle class="rv-ring-bg" cx="20" cy="20" :r="R" />
            <circle
              class="rv-ring-fg"
              cx="20"
              cy="20"
              :r="R"
              :style="{ strokeDasharray: CIRC, strokeDashoffset: ringOffset(ringPct(g.c)) }" />
            <text x="20" y="21" class="rv-ring-txt">{{ ringPct(g.c) }}</text>
          </svg>
          <span class="rv-group-title">{{ g.ct }}</span>
          <span class="rv-group-n">{{ g.items.length }}</span>
        </summary>
        <div class="tp-list">
          <div v-for="e in g.items" :key="e.a" class="ghit ghit-row">
            <a class="ghit-main" :href="questionHref(e)">
              <span class="ghit-tag">{{ TYPE_LABEL[e.t] || e.t }}</span>
              <span class="ghit-q">{{ e.q }}</span>
              <span class="ghit-meta">
                {{ e.kp }} · {{ e.src }}
                <span v-if="dueLabel(e.a)" class="rv-due-pill">{{ dueLabel(e.a) }}</span>
              </span>
            </a>
            <button class="io-btn rm-wrong" @click="removeWrong(e.a)">Remove</button>
          </div>
        </div>
      </details>
    </section>

    <FlashcardDeck v-if="fcQueue" :queue="fcQueue" :label="fcLabel" @close="closeFc" />
  </div>
</template>
