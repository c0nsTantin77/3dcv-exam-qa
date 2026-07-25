<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { Store, sm2Next, type Rating } from "../../lib/client/store";
import { highlightIn } from "../../lib/client/highlight";
import { userWords, wordVariants } from "../../lib/client/answer-match";

interface Calc { label?: string; value: number; tol?: number }
interface Card {
  a: string;
  q: string;
  ans: string;
  ext: string;
  t: string;
  opts: { text: string; correct: boolean }[] | null;
  calc: Calc[] | null;
  src: string;
  ct: string;
  kp: string;
  fig: { src: string; alt?: string; caption?: string } | null;
}

const props = defineProps<{ queue: string[]; label: string }>();
const emit = defineEmits<{ (e: "close"): void }>();

const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const cards = ref<Card[]>([]);
const idx = ref(0);
const revealed = ref(false);
const loading = ref(true);
const reviewed = ref(0);

// per-card attempt state
const picked = ref<Set<number>>(new Set());
const selfText = ref("");
const calcVals = ref<string[]>([]);
const answerEl = ref<HTMLElement | null>(null);

// per-card note — the SAME note as the question's own (Store), editable here
const NOTE_MAX = 1000;
const noteOpen = ref(false);
const noteText = ref("");
const notePreviewHtml = ref("");
let renderNote: ((s: string) => string) | null = null;
async function updateNotePreview(): Promise<void> {
  if (!noteText.value.trim()) {
    notePreviewHtml.value = "";
    return;
  }
  try {
    if (!renderNote) renderNote = (await import("../../lib/md-notes")).renderNote;
    notePreviewHtml.value = renderNote(noteText.value);
  } catch {
    notePreviewHtml.value = ""; // preview is best-effort; the textarea still saves
  }
}
function saveNote(): void {
  if (noteText.value.length > NOTE_MAX) noteText.value = noteText.value.slice(0, NOTE_MAX);
  if (current.value) Store.setNote(current.value.a, noteText.value.trim());
  void updateNotePreview();
}

const LETTERS = "ABCDEFGH";
const total = computed(() => cards.value.length);
const current = computed(() => cards.value[idx.value] || null);
const finished = computed(() => !loading.value && total.value > 0 && idx.value >= total.value);
const empty = computed(() => !loading.value && total.value === 0);
const isMc = computed(() => !!current.value?.opts?.length);
const isCalc = computed(() => !isMc.value && !!current.value?.calc?.length);

// cards.json ships pre-rendered HTML, so these are used verbatim via v-html
const qHtml = computed(() => current.value?.q ?? "");
const ansHtml = computed(() => current.value?.ans ?? "");
const extHtml = computed(() => current.value?.ext ?? "");
const optHtml = (t: string): string => t;

function ivlLabel(r: Rating): string {
  if (!current.value) return "";
  const d = sm2Next(Store.srsEntry(current.value.a), r).ivl;
  return d >= 1 ? `${d}d` : "<1d";
}
function toggle(i: number): void {
  if (revealed.value) return;
  const s = new Set(picked.value);
  s.has(i) ? s.delete(i) : s.add(i);
  picked.value = s;
}
function calcOk(i: number): boolean {
  const c = current.value?.calc?.[i];
  if (!c) return false;
  const got = parseFloat((calcVals.value[i] ?? "").replace(/[, ]/g, ""));
  return Number.isFinite(got) && Math.abs(got - c.value) <= Math.max(c.tol ?? 0, 1e-9);
}

function resetAttempt(): void {
  picked.value = new Set();
  selfText.value = "";
  calcVals.value = (current.value?.calc ?? []).map(() => "");
  revealed.value = false;
  noteOpen.value = false;
  noteText.value = current.value ? Store.note(current.value.a) : "";
  void updateNotePreview();
}
watch(idx, () => resetAttempt());

async function reveal(): Promise<void> {
  revealed.value = true;
  await nextTick();
  // green-highlight the student's overlapping words in the reference (open questions)
  if (!isMc.value && !isCalc.value && selfText.value.trim() && answerEl.value) {
    for (const w of userWords(selfText.value))
      for (const v of wordVariants(w)) highlightIn([answerEl.value], v, "kw-hit", true);
  }
}
function rate(r: Rating): void {
  if (!current.value || !revealed.value) return;
  Store.rate(current.value.a, r);
  if (r === "again") {
    // "Again" = redo this card now: keep the typed answer / numbers, but clear
    // the selected multiple-choice options so they can be re-picked cleanly.
    // (idx unchanged → selfText / calcVals are not reset.)
    picked.value = new Set();
    revealed.value = false;
  } else {
    reviewed.value += 1;
    idx.value += 1;
  }
}
function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape") return emit("close");
  if (finished.value || empty.value || loading.value) return;
  if (!revealed.value && e.key === "Enter") {
    e.preventDefault();
    void reveal();
  } else if (revealed.value && ["1", "2", "3", "4"].includes(e.key)) {
    rate((["again", "hard", "good", "easy"] as Rating[])[Number(e.key) - 1]);
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKey);
  try {
    const all: Card[] = await fetch(`${base}/cards.json`).then((r) => r.json());
    const byId: Record<string, Card> = {};
    all.forEach((c) => (byId[c.a] = c));
    cards.value = props.queue.map((a) => byId[a]).filter(Boolean);
    resetAttempt();
  } catch (e) {
    console.warn("flashcards load failed", e);
  } finally {
    loading.value = false;
  }
});
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="fc-overlay">
    <div class="fc-card">
      <div class="fc-top">
        <span class="fc-title">🃏 {{ label }}</span>
        <span v-if="!loading && !finished && !empty" class="fc-prog">{{ idx + 1 }} / {{ total }}</span>
        <button class="fc-x" @click="emit('close')" aria-label="Close">✕</button>
      </div>

      <div v-if="loading" class="fc-body"><p class="hint">Loading cards…</p></div>

      <div v-else-if="empty" class="fc-body fc-empty">
        <p>Nothing to study here right now. 🎉</p>
        <button class="fc-btn" @click="emit('close')">Back to review</button>
      </div>

      <div v-else-if="finished" class="fc-body fc-empty">
        <p>✅ Done — you rated <b>{{ reviewed }}</b> card{{ reviewed === 1 ? "" : "s" }}.</p>
        <button class="fc-btn primary" @click="emit('close')">Finish</button>
      </div>

      <div v-else-if="current" class="fc-body">
        <div class="fc-meta">{{ current.ct }} · {{ current.kp }} · {{ current.src }}</div>
        <figure v-if="current.fig" class="q-figure">
          <img :src="`${base}/figures/${current.fig.src}`" :alt="current.fig.alt || ''" />
          <figcaption v-if="current.fig.caption">{{ current.fig.caption }}</figcaption>
        </figure>
        <div class="fc-q" v-html="qHtml"></div>

        <!-- attempt controls (try before revealing; optional) -->
        <ul v-if="isMc" class="fc-opts" :class="{ done: revealed }">
          <li
            v-for="(o, i) in current.opts"
            :key="i"
            :class="{
              picked: picked.has(i),
              hit: revealed && o.correct,
              bad: revealed && picked.has(i) && !o.correct,
              missed: revealed && !picked.has(i) && o.correct,
            }"
            @click="toggle(i)">
            <input type="checkbox" :checked="picked.has(i)" :disabled="revealed" tabindex="-1" />
            <span class="opt-letter">{{ LETTERS[i] }}</span>
            <span class="opt-text" v-html="optHtml(o.text)"></span>
            <span v-if="revealed" class="opt-mark">{{ o.correct ? "✅" : picked.has(i) ? "❌" : "" }}</span>
          </li>
        </ul>

        <div v-else-if="isCalc" class="fc-calc">
          <label v-for="(c, i) in current.calc" :key="i" class="calc-field">
            <span v-if="c.label" class="calc-label">{{ c.label }}</span>
            <input
              class="calc-in"
              :class="revealed ? (calcOk(i) ? 'ok' : calcVals[i] ? 'bad' : '') : ''"
              v-model="calcVals[i]"
              :readonly="revealed"
              inputmode="text"
              autocomplete="off" />
            <span v-if="revealed" class="calc-mark">{{ calcVals[i] ? (calcOk(i) ? "✓" : "✗") : "" }}</span>
          </label>
        </div>

        <textarea
          v-else
          class="self-area fc-self"
          v-model="selfText"
          :readonly="revealed"
          rows="3"
          placeholder="Write your answer (optional)…"></textarea>

        <button v-if="!revealed" class="fc-btn primary fc-show" @click="reveal">
          Show answer <small>(enter)</small>
        </button>

        <div v-else class="fc-back">
          <div class="answer">
            <div class="answer-label">Answer</div>
            <div ref="answerEl" v-html="ansHtml"></div>
          </div>
          <div v-if="extHtml" class="extend">
            <div class="extend-label">💡 Extended memory</div>
            <div v-html="extHtml"></div>
          </div>
          <div class="fc-rate">
            <button class="fc-rate-btn again" @click="rate('again')">Again<small>{{ ivlLabel("again") }}</small></button>
            <button class="fc-rate-btn hard" @click="rate('hard')">Hard<small>{{ ivlLabel("hard") }}</small></button>
            <button class="fc-rate-btn good" @click="rate('good')">Good<small>{{ ivlLabel("good") }}</small></button>
            <button class="fc-rate-btn easy" @click="rate('easy')">Easy<small>{{ ivlLabel("easy") }}</small></button>
          </div>
          <p class="fc-hint">Keys: 1 Again · 2 Hard · 3 Good · 4 Easy · Esc close</p>
        </div>

        <div class="fc-note">
          <button
            type="button"
            class="fc-note-btn"
            :class="{ has: noteText.trim() }"
            @click="noteOpen = !noteOpen">
            📝 {{ noteText.trim() ? "Note" : "Add note" }}
          </button>
          <div v-if="noteOpen" class="fc-note-wrap">
            <textarea
              class="self-area"
              v-model="noteText"
              maxlength="1000"
              rows="3"
              placeholder="Your note (Markdown & $math$) — shared with this question"
              @input="saveNote"></textarea>
            <div class="note-foot">
              <span class="note-md-hint">Markdown &amp; <span class="mono">$math$</span></span>
              <span class="note-count">{{ noteText.length }} / 1000</span>
            </div>
            <div v-if="notePreviewHtml" class="note-preview md-note" v-html="notePreviewHtml"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
