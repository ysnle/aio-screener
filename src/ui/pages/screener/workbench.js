// Screener workbench: saved screens, ScreenDefinition preview/run/replay (developer surface).
import { PRESET_LESSONS, presetMarketLine } from '../../../domain/screener/preset-lessons.js';
import { readMarketRegime } from '../../components/market-regime.js';
import { selectScreenerState } from '../../../state/selectors/screener.js';
import { createSavedScreen, exportSavedScreen, importSavedScreen } from '../../../domain/screener/saved-screens.js';
import { createScreenDefinition } from '../../../data/contracts/screener.js';
import { finiteNumber as finite } from '../../../domain/shared/number.js';
import { renderFilterChips } from './filters.js';
import { BUILDER_FIELDS, FILTER_LABELS, PRESET_SHORT_LABELS, RUN_CONDITION_FIELDS, SCREENER_COLUMN_REGISTRY, scopedRows, selectedValue } from './model.js';
// v58.75 (teach-and-check D5): one folded block under the screen buttons — why this screen's condition is used, where it
// tends to work and not, its common failure, the columns that show it (their header hints carry the formulas), and one
// line on today's shared market state. The open/closed state survives re-renders.
function renderPresetLesson(documentRef, root, presetsHost, screenId, screenName) {
  const lesson = PRESET_LESSONS[screenId];
  let block = documentRef.getElementById('scr-preset-lesson');
  if (!lesson) { if (block) block.hidden = true; return; }
  if (!block) {
    block = documentRef.createElement('details');
    block.id = 'scr-preset-lesson';
    block.className = 'sx-disclosure scr-preset-lesson';
    presetsHost.insertAdjacentElement('afterend', block);
  }
  block.hidden = false;
  const open = block.open;
  const name = screenName || '이 조건';
  const summary = documentRef.createElement('summary');
  summary.textContent = `${name} — 이 조건을 보는 이유`;
  const columnLabels = lesson.columns.map((key) => SCREENER_COLUMN_REGISTRY.find((column) => column.key === key)?.label).filter(Boolean);
  const rows = [
    ['원리', lesson.principle],
    ['잘 통하는 환경', lesson.works],
    ['잘 안 통하는 환경', lesson.fails],
    ['흔한 실패', lesson.failure],
    ['표에서 볼 컬럼', `${columnLabels.join(' · ')} — 머리글을 누르거나 마우스를 올리면 계산 기준이 나옵니다(컬럼 선택에서 켤 수 있습니다).`],
    ['지금 시장', presetMarketLine(lesson, readMarketRegime(root))]
  ];
  const list = documentRef.createElement('dl');
  list.className = 'regime-evidence';
  rows.forEach(([label, value]) => { const dt = documentRef.createElement('dt'); dt.textContent = label; const dd = documentRef.createElement('dd'); dd.textContent = value; list.append(dt, dd); });
  const note = documentRef.createElement('p');
  note.className = 'theme-strength-basis';
  note.textContent = '조건을 고르는 기준과 원리를 적은 것이며, 이 조건으로 고른 종목이 오른다는 뜻이 아닙니다.';
  block.replaceChildren(summary, list, note);
  block.open = open;
}

// LC-64: the builder chips show only the conditions that enter the run definition (rank, RSI, 3-month return).
export function builderConditions(documentRef) {
  return BUILDER_FIELDS.flatMap(definition => {
    if (!RUN_CONDITION_FIELDS.includes(definition.value)) return [];
    const value = String(documentRef?.getElementById(definition.target)?.value || '').trim();
    if (!value || (definition.value === 'rank' && value === '0')) return [];
    return [{ field: definition.value, label: definition.label, value, target: definition.target }];
  });
}

/** Saved screens, preview/run/replay of a ScreenDefinition and the run archive. */
export function createWorkbenchController(ctx) {
  const { documentRef, root, store, page, bag, workbench, sortState, visibleLimit, columnState, selectedSymbols, compareSymbols, liveReader, watchlistReader, profileReader, onWatchlistToggle, onProfileChange, onUniverseScopeChange } = ctx;
  ctx.readBuilderConditions = () => builderConditions(documentRef);
      ctx.workbenchStatus = documentRef.getElementById('scr-workbench-status');
      const definitionEditor = documentRef.getElementById('scr-definition-editor');
      const workbenchPresets = documentRef.getElementById('scr-workbench-presets');
      const readinessPreview = documentRef.getElementById('scr-readiness-preview');
      const runHistory = documentRef.getElementById('scr-run-history');
      // P2107: the list is static markup, so a read cut short by leaving the screen must not leave it marked as loading;
      // the next visit's render only reads the archive when no read is marked.
      bag.add(() => { if (runHistory?.dataset.archiveLoaded === 'loading') delete runHistory.dataset.archiveLoaded; });
      const outcomeLab = documentRef.getElementById('scr-outcome-lab');
      const operationsState = documentRef.getElementById('scr-ops-state');
       ctx.defaultScreens = () => {
         const stored = selectScreenerState(store.getState())?.savedScreens;
         return Array.isArray(stored) && stored.length ? stored : (workbench.getDefaultScreens?.() || []);
       };
      ctx.syncDefinitionEditor = () => {
        if (definitionEditor && ctx.activeDefinition) definitionEditor.value = exportSavedScreen({ definition: ctx.activeDefinition });
      };
       ctx.runGeneration = 0;
       ctx.archiveGeneration = 0;
       ctx.refreshRunArchive = async () => {
         if (!runHistory) return;
         const generation = ++ctx.archiveGeneration;
         runHistory.dataset.archiveLoaded = 'loading';
         try {
           if (typeof workbench.list !== 'function') throw new Error('SCREEN_ARCHIVE_UNAVAILABLE');
           const entries = await workbench.list();
           // A screen left while the list was read keeps no 'loading' marker on the shared #scr-run-history node: the
           // next mount only loads an archive that has no marker, so a stale one hid the replay buttons for good.
           if (!ctx.mountActive) { if (runHistory.dataset.archiveLoaded === 'loading') delete runHistory.dataset.archiveLoaded; return; }
           if (generation !== ctx.archiveGeneration) return;
           runHistory.replaceChildren();
           runHistory.dataset.archiveLoaded = 'true';
           if (!entries.length) runHistory.textContent = '보관한 사용자 실행 없음, 실행하면 입력을 이 브라우저에 최대 5개 보관합니다.';
           for (const entry of entries) {
             const item = documentRef.createElement('div');
             const label = documentRef.createElement('span');
             label.textContent = `${entry.name}, ${entry.savedAt.slice(0, 16)} `;
             const replay = documentRef.createElement('button');
             replay.type = 'button'; replay.className = 'aio-btn-table'; replay.textContent = '저장 입력으로 재현';
             replay.addEventListener('click', async () => {
               const run = ++ctx.runGeneration;
               try {
                 const result = await workbench.replay(entry.id);
                 if (!ctx.mountActive || run !== ctx.runGeneration) return;
                 ctx.activeDefinition = result.definition; ctx.activeScreenId = ctx.activeDefinition.screenId;
                 ctx.activeResult = result; ctx.activeRows = result.rows;
                 selectedSymbols.clear(); visibleLimit.value = 12;
                 // Codex browser audit H113: the replay header names which run, when, and on what data; the previous
                 // preview (another preset's definition and hash) is dropped so no label or accessible name keeps it.
                 ctx.activePreview = null; ctx.activePreviewKey = null;
                 { const passedOnly = documentRef.getElementById('scr-passed-only'); if (passedOnly) passedOnly.checked = true; }
                 const replayMeta = result.snapshotMetadata || {};
                 const dataDate = replayMeta.factorSessionDateByMarket?.US || String(replayMeta.factorSessionDate || replayMeta.asOf || '').slice(0, 10) || '확인 필요';
                 if (ctx.workbenchStatus) ctx.workbenchStatus.textContent = `보관 실행 재현, ${entry.name}, 실행 ${entry.savedAt.slice(0, 16)}, 자료 기준 ${dataDate} — 현재 시장이 아닌 당시 결과입니다. 지금 자료로 보려면 조건을 다시 실행합니다.`;
                 ctx.syncDefinitionEditor(); ctx.renderWorkbench(); ctx.renderNow();
               } catch (_) { if (ctx.mountActive && run === ctx.runGeneration && ctx.workbenchStatus) ctx.workbenchStatus.textContent = '재현 불가, 모델 버전 또는 보관 데이터가 일치하지 않습니다.'; }
             });
             const remove = documentRef.createElement('button');
             remove.type = 'button'; remove.className = 'aio-btn-table'; remove.textContent = '보관 삭제';
             remove.addEventListener('click', async () => {
               try { await workbench.remove(entry.id); if (ctx.mountActive) ctx.refreshRunArchive(); }
               catch (_) { if (ctx.mountActive && ctx.workbenchStatus) ctx.workbenchStatus.textContent = '로컬 보관 삭제 실패'; }
             });
             item.append(label, replay, remove); runHistory.appendChild(item);
           }
         } catch (_) {
           if (!ctx.mountActive) { if (runHistory.dataset.archiveLoaded === 'loading') delete runHistory.dataset.archiveLoaded; return; }
           if (generation !== ctx.archiveGeneration) return;
           runHistory.dataset.archiveLoaded = 'unavailable';
           runHistory.textContent = '이 브라우저에서는 실행 입력을 보관할 수 없습니다.';
         }
       };
       ctx.runDefinition = async (definition) => {
         const generation = ++ctx.runGeneration;
         try {
           const saved = createSavedScreen({ definition });
           ctx.activeDefinition = saved.definition;
           ctx.activeScreenId = ctx.activeDefinition.screenId;
           if (typeof workbench.run !== 'function') throw new Error('SCREEN_ENGINE_UNAVAILABLE');
           const result = await workbench.run(ctx.activeDefinition);
           if (generation !== ctx.runGeneration || !ctx.mountActive) return;
           if (result?.rows) {
             ctx.activeResult = result;
             ctx.activeRows = result.rows;
             { const passedOnly = documentRef.getElementById('scr-passed-only'); if (passedOnly) passedOnly.checked = true; }
             selectedSymbols.clear();
             visibleLimit.value = 12;
              // LC-25: name the run and its denominator so the executed judgment is not confused
              // with the table's separate display scope.
              const runRowCount = finite(result.run?.rowCount) != null ? ` / ${result.run.rowCount}` : '';
              const runIdText = result.run?.runId ? `, run ${String(result.run.runId).slice(0, 12)}` : '';
              if (ctx.workbenchStatus) ctx.workbenchStatus.textContent = `실행 완료, ${result.persistence?.status === 'persisted' ? '입력 로컬 보관됨' : '입력 보관 실패: 이 화면에서만 유지'}${runIdText}, 실행 판정 ${result.run?.passed || 0} 통과 / ${result.run?.unavailable || 0} 데이터 부족${runRowCount}`;
             ctx.syncDefinitionEditor();
             ctx.renderWorkbench();
             ctx.renderNow();
             ctx.refreshRunArchive();
           }
         } catch (error) {
           if (generation !== ctx.runGeneration || !ctx.mountActive) return;
           if (ctx.workbenchStatus) ctx.workbenchStatus.textContent = `실행할 수 없습니다, 정의를 확인하세요.`;
           const detail = documentRef.getElementById('scr-definition-error-detail');
           if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_definition'; }
         }
       };
       ctx.renderWorkbench = () => {
         const state = selectScreenerState(store.getState()) || {};
         if (ctx.workbenchStatus) {
           ctx.workbenchStatus.dataset.runId = ctx.activeResult?.run?.runId || '';
           ctx.workbenchStatus.dataset.resultHash = ctx.activeResult?.resultHash || '';
           ctx.workbenchStatus.dataset.explanationsHash = ctx.activeResult?.explanationsHash || '';
           ctx.workbenchStatus.dataset.snapshotId = ctx.activeResult?.run?.snapshotId || '';
           ctx.workbenchStatus.dataset.rowCount = String(ctx.activeResult?.run?.rowCount || 0);
           ctx.workbenchStatus.dataset.persistence = ctx.activeResult?.persistence?.status || '';
         }
         const screens = ctx.defaultScreens();
         if (workbenchPresets) {
           workbenchPresets.replaceChildren();
           screens.forEach((screen) => {
             const button = documentRef.createElement('button');
             button.type = 'button';
             button.className = 'aio-btn-table';
             button.className += ` scr-screen-chip${screen.definition.screenId === ctx.activeScreenId ? ' active' : ''}`;
             button.setAttribute('aria-pressed', screen.definition.screenId === ctx.activeScreenId ? 'true' : 'false');
             button.dataset.aioScreenerAction = 'screen-preset';
             button.dataset.aioScreenerArg = screen.definition.screenId;
             // v58.56 (4b): a phone shows the one-word name (균형 · 모멘텀 · 추세 · 저변동) so the row of screens fits; the full
             // name stays the button's accessible name and the wider layouts' label.
             const full = documentRef.createElement('span');
             full.className = 'scr-preset-full';
             full.textContent = screen.label;
             button.append(full);
             const short = PRESET_SHORT_LABELS[screen.definition.screenId];
             if (short) {
               const compact = documentRef.createElement('span');
               compact.className = 'scr-preset-short';
               compact.setAttribute('aria-hidden', 'true');
               compact.textContent = short;
               button.append(compact);
               button.classList.add('has-short');
             }
             workbenchPresets.appendChild(button);
           });
           { const lessonId = ctx.activeScreenId || ctx.activeDefinition?.screenId || screens[0]?.definition?.screenId || null; renderPresetLesson(documentRef, root, workbenchPresets, lessonId, screens.find((screen) => screen.definition.screenId === lessonId)?.label); }
         }
         const screenSelect = documentRef.getElementById('scr-screen-select');
         if (screenSelect) {
           const currentValue = ctx.activeScreenId || ctx.activeDefinition?.screenId || screens[0]?.definition?.screenId || '';
           if (screenSelect.dataset.aioScreenSignature !== screens.map((screen) => screen.definition.screenId).join('|')) {
             screenSelect.replaceChildren();
             screens.forEach((screen) => {
               const option = documentRef.createElement('option');
               option.value = screen.definition.screenId;
               option.textContent = screen.label;
               screenSelect.appendChild(option);
             });
             screenSelect.dataset.aioScreenSignature = screens.map((screen) => screen.definition.screenId).join('|');
           }
           screenSelect.value = currentValue;
         }
         if (!ctx.activeDefinition && screens[0]?.definition) {
           ctx.activeDefinition = screens[0].definition;
           ctx.activeScreenId = ctx.activeDefinition.screenId;
         }
         ctx.syncDefinitionEditor();
         // v59.70 (S12): the chosen 조건 화면 leads the chip row under the bar.
         { const screenId = ctx.activeScreenId || ctx.activeDefinition?.screenId; renderFilterChips(documentRef, { screen: { label: screens.find((screen) => screen.definition.screenId === screenId)?.label || '' } }); }
         ctx.syncColumnControls();
         const readiness = ctx.activeResult?.readiness || state.readiness;
         const collectedCount = Number.isFinite(state?.metadata?.artifactRows) ? state.metadata.artifactRows : null;
         const collectedUniverse = Number.isFinite(state?.metadata?.universe) ? state.metadata.universe : (readiness?.rowCount ?? null);
         const collectedNote = collectedCount > 0 && collectedUniverse > 0 ? `수집 성공 ${collectedCount}/${collectedUniverse}, ` : '';
         if (readinessPreview) readinessPreview.textContent = readiness ? `${collectedNote}필수 자료 있는 종목 ${readiness.eligibleCount}/${readiness.rowCount}, ${readiness.coveragePct}%, 필수: ${(readiness.requiredFields || []).map((field) => field.split('.').pop()).join(', ') || '없음'}` : '필드 준비도 미리보기 대기';
          // P1164/B04(12:U01): 실행 전 카운트는 '선택한 정의의 통과'가 아니다 — 빈 조건 파이프라인
          // 미리보기 결과다. '조건 적용 전 계산 가능'으로 부르고 어떤 정의·해시인지 밝힌다.
          if (ctx.workbenchStatus && !ctx.activeResult) {
            const pipelineRun = state.lastRun;
            const pipelineId = pipelineRun?.screenId ? String(pipelineRun.screenId) : null;
            ctx.workbenchStatus.textContent = pipelineRun
              ? `조건 적용 전 계산 가능 ${pipelineRun.passed}개 (조건 없는 미리보기 정의 ${pipelineId || '—'}), 실행하면 선택한 정의로 다시 계산합니다`
              : '실행 전 미리보기';
          }
         if (runHistory && !runHistory.dataset.archiveLoaded) ctx.refreshRunArchive();
         if (outcomeLab) outcomeLab.textContent = state.outcomes?.length ? `실행 후 결과, ${state.outcomes.length}개 관측, 1/5/21/63거래일 후` : '실행 후 결과, 자동 추적 미연결, 보관 입력 재현만 지원';
         if (operationsState) operationsState.textContent = state.refreshPlan ? `데이터 갱신, 대기 ${state.refreshPlan.queued?.length || 0}건, 한도 차단 체크됨` : `데이터 갱신, ${state?.metadata?.asOf ? `${String(state.metadata.asOf).slice(0, 10)} 생성` : '미수신'}, 사용자 실행과 분리`;
       };
       ctx.saveCurrentScreen = () => {
         if (!ctx.activeDefinition || typeof workbench.setSavedScreens !== 'function') return;
         const state = selectScreenerState(store.getState()) || {};
         const saved = createSavedScreen({ definition: ctx.activeDefinition });
         const current = Array.isArray(state.savedScreens) ? state.savedScreens : ctx.defaultScreens();
         const next = [...current.filter((screen) => screen.definition?.screenId !== saved.definition.screenId), saved];
         workbench.setSavedScreens(next);
         if (ctx.workbenchStatus) ctx.workbenchStatus.textContent = `이번 세션에 조건 저장, ${saved.label}, 영구 보관은 실행 입력 보관 또는 JSON 내보내기`;
       };
       ctx.buildVisualDefinition = () => {
         if (!ctx.activeDefinition) return null;
         const nodes = ctx.readBuilderConditions().flatMap((condition) => {
           const numeric = Number(condition.value);
           if (condition.field === 'rank' && Number.isFinite(numeric)) return [{ type: 'range', field: 'rank', min: numeric, nullPolicy: 'unknown' }];
           if (condition.field === 'rsi' && Number.isFinite(numeric)) return [{ type: 'range', field: 'price.rsi14', min: numeric, nullPolicy: 'unknown' }];
           if (condition.field === 'momentum' && Number.isFinite(numeric)) return [{ type: 'range', field: 'price.ret3m', min: numeric, nullPolicy: 'unknown' }];
           return [];
         });
         const current = ctx.activeDefinition.filtersAST?.type === 'and' ? ctx.activeDefinition.filtersAST.children || [] : [ctx.activeDefinition.filtersAST];
         return createScreenDefinition({ ...ctx.activeDefinition, filtersAST: { type: 'and', children: [
           ...current.filter(node => node?.origin !== 'visual-builder' && node?.origin !== 'market-scope'),
           ...nodes.map(node => ({ ...node, origin: 'visual-builder' })),
           { type: 'enum', field: 'identity.market', values: [selectedValue(documentRef, 'scr-listing-market') || 'US'], origin: 'market-scope', nullPolicy: 'unknown' }
         ] } });
       };
        // P1165 (19 작업 카드): 실행 전 미리보기는 선택한 정의 + 현재 snapshot으로 계산한다.
        // 조건(내장/사용자)이 바뀌면 definitionHash가 바뀌므로 같은 키에서만 캐시한다.
        ctx.ensurePreview = () => {
          if (ctx.activeResult) { ctx.activePreview = null; ctx.activePreviewKey = null; return null; }
          const definition = ctx.buildVisualDefinition() || ctx.activeDefinition;
          if (!definition || typeof workbench.preview !== 'function') return null;
          const current = selectScreenerState(store.getState());
          const key = `${definition.definitionHash || definition.screenId}|${current?.snapshotId || 'unknown'}|${current?.workbenchHash || ''}`;
          if (key === ctx.activePreviewKey && ctx.activePreview) return ctx.activePreview;
          try { ctx.activePreview = workbench.preview(definition); ctx.activePreviewKey = key; }
          catch (_) { ctx.activePreview = null; ctx.activePreviewKey = null; }
          return ctx.activePreview;
        };
       ctx.selectDefinition = (screenId) => {
         const screen = ctx.defaultScreens().find(item => item.definition.screenId === screenId);
         if (!screen) return;
         ++ctx.runGeneration;
         ctx.activeDefinition = screen.definition;
         ctx.activeScreenId = screen.definition.screenId;
         ctx.activeResult = null;
         ctx.activeRows = null;
         // v58.56: '실행 통과만' is the table's scope, not a filter of the previous screen — switching screens used to clear it,
         // so the first preset tap showed every rejected row (904 instead of 243) after the first view had shown passes only.
         Object.keys(FILTER_LABELS).filter((id) => id !== 'scr-passed-only').forEach(id => {
           const control = documentRef.getElementById(id);
           if (control?.type === 'checkbox') control.checked = false;
           else if (control) control.value = id === 'scr-min-rank' ? '0' : '';
         });
         visibleLimit.value = 12;
         sortState.column = 'screenRank'; sortState.ascending = true;
         documentRef.getElementById('scr-order').value = 'screenRank';
         ctx.syncDefinitionEditor(); ctx.renderWorkbench(); ctx.renderNow();
       };
  ctx.syncPreviewStatus = (preview) => {
         // P1165 (12 U01): 실행 전 상태 줄도 선택한 정의의 미리보기를 인용한다 — 파이프라인 기본
         // 수치를 '선택한 정의의 통과'로 읽히게 두지 않는다. 실행하면 activeResult가 대신한다.
         if (!ctx.activeResult && preview && ctx.workbenchStatus) {
           // P1431: plain status; the definition id/hash stay on the element for audit, not in the sentence.
           const screenLabel = documentRef.getElementById('scr-screen-select')?.selectedOptions?.[0]?.textContent || preview.definition?.screenId || '선택한 조건';
           ctx.workbenchStatus.textContent = `${screenLabel} 미리보기, 대상 ${scopedRows(preview.rows || [], selectedValue(documentRef, 'scr-listing-market') || 'US').length}종목 중 조건 통과 ${scopedRows(preview.rows || [], selectedValue(documentRef, 'scr-listing-market') || 'US').filter(row => row.screenStatus === 'passed').length}, 조건 판단 자료 부족 ${scopedRows(preview.rows || [], selectedValue(documentRef, 'scr-listing-market') || 'US').filter(row => row.screenStatus === 'unavailable').length}`;
           ctx.workbenchStatus.title = `${preview.definition?.screenId || '—'}, ${String(preview.definition?.definitionHash || '').slice(0, 8)}, 조건 실행을 누르면 이 입력으로 고정합니다`;
         }
  };
  ctx.actions.push((action, argument, actionNode) => {
    if (action === 'screen-preset' || action === 'screen-select') {
           ctx.selectDefinition(argument);
    } else if (action === 'screen-new') {
           ++ctx.runGeneration;
           ctx.activeDefinition = ctx.defaultScreens()[0]?.definition || null;
           ctx.activeScreenId = null;
           ctx.activeResult = null;
           ctx.activeRows = null;
           ctx.syncDefinitionEditor();
           if (ctx.workbenchStatus) ctx.workbenchStatus.textContent = '새 화면 초안, 조건을 추가한 뒤 실행하세요.';
           ctx.renderNow();
    } else if (action === 'screen-save') {
           ctx.saveCurrentScreen();
    } else if (action === 'screen-run-visual') {
           try {
             const visualDefinition = ctx.buildVisualDefinition();
             if (!visualDefinition) throw new Error('SCREEN_DRAFT_EMPTY');
             ctx.runDefinition(visualDefinition);
           } catch (error) {
             if (ctx.workbenchStatus) ctx.workbenchStatus.textContent = '실행할 수 없습니다, 조건을 확인하세요.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_visual_definition'; }
           }
    } else if (action === 'screen-run') {
           try {
             const parsed = JSON.parse(definitionEditor?.value || '');
             const saved = parsed.definition ? importSavedScreen(JSON.stringify(parsed)) : createSavedScreen({ definition: parsed });
             ctx.runDefinition(saved.definition);
           } catch (error) {
             if (ctx.workbenchStatus) ctx.workbenchStatus.textContent = '실행할 수 없습니다, JSON 형식 또는 화면 조건을 확인하세요.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_json'; }
           }
    } else if (action === 'screen-import') {
           try {
             const parsed = JSON.parse(definitionEditor?.value || '');
             const saved = parsed.definition ? importSavedScreen(JSON.stringify(parsed)) : createSavedScreen({ definition: parsed });
             ++ctx.runGeneration;
             ctx.activeDefinition = saved.definition;
             ctx.activeScreenId = ctx.activeDefinition.screenId;
             ctx.activeResult = null;
             ctx.activeRows = null;
             if (ctx.workbenchStatus) ctx.workbenchStatus.textContent = '화면 정의를 불러왔습니다, 실행 전 미리보기 상태입니다.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) detail.hidden = true;
             ctx.renderWorkbench();
             ctx.renderNow();
           } catch (error) {
             if (ctx.workbenchStatus) ctx.workbenchStatus.textContent = '가져올 수 없습니다, JSON 형식을 확인하세요.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_json'; }
           }
    } else if (action === 'screen-export') {
           if (!ctx.activeDefinition) ctx.activeDefinition = ctx.defaultScreens()[0]?.definition || null;
           ctx.syncDefinitionEditor();
           documentRef.getElementById('scr-developer-drawer')?.setAttribute('open', '');
           if (ctx.workbenchStatus) ctx.workbenchStatus.textContent = '개발자 영역에 ScreenDefinition을 내보냈습니다.';
    } else return false;
    return true;
  });
  ctx.inputs.push((event) => {
    if (event.target.matches?.('#scr-screen-select')) {
           ctx.selectDefinition(event.target.value);
    } else return false;
    return true;
  });
}
