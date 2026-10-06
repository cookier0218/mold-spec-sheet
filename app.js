/* 模具調校規格表 — 惟家 JustPlus
   資料全部存在瀏覽器 localStorage，不上傳。 */
(function () {
  "use strict";

  var STORAGE_KEY = "justplus-mold-spec/v1";
  var form = document.getElementById("specForm");
  var recordSelect = document.getElementById("recordSelect");
  var saveStatus = document.getElementById("saveStatus");
  var importFile = document.getElementById("importFile");
  var metaName = document.getElementById("metaName");
  var metaUpdated = document.getElementById("metaUpdated");

  // state = { records: [{id, name, data, updatedAt}], currentId }
  var state = loadState();

  // ---------- 儲存層 ----------
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.records) && parsed.records.length) {
          return parsed;
        }
      }
    } catch (e) { /* 壞資料就重建 */ }
    var first = newRecord("規格表 1");
    return { records: [first], currentId: first.id };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      alert("儲存失敗：瀏覽器空間可能已滿或處於無痕模式。");
    }
  }

  function uid() {
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function newRecord(name) {
    return { id: uid(), name: name, data: {}, updatedAt: nowStr() };
  }

  function nowStr() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function currentRecord() {
    var rec = state.records.find(function (r) { return r.id === state.currentId; });
    if (!rec) { rec = state.records[0]; state.currentId = rec.id; }
    return rec;
  }

  // ---------- 表單 <-> 資料 ----------
  function collectFormData() {
    var data = {};
    var els = form.querySelectorAll("input[name]");
    els.forEach(function (el) {
      if (el.type === "checkbox") data[el.name] = el.checked;
      else data[el.name] = el.value;
    });
    return data;
  }

  function fillForm(data) {
    data = data || {};
    var els = form.querySelectorAll("input[name]");
    els.forEach(function (el) {
      var v = data[el.name];
      if (el.type === "checkbox") el.checked = !!v;
      else el.value = (v == null ? "" : v);
    });
  }

  // ---------- UI ----------
  function renderRecordSelect() {
    recordSelect.innerHTML = "";
    state.records.forEach(function (r) {
      var opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name;
      if (r.id === state.currentId) opt.selected = true;
      recordSelect.appendChild(opt);
    });
  }

  function renderMeta() {
    var rec = currentRecord();
    metaName.textContent = rec.name;
    metaUpdated.textContent = rec.updatedAt || "—";
  }

  function flashSaved() {
    saveStatus.classList.remove("saving");
    saveStatus.textContent = "已自動儲存 ✓";
  }
  function flashSaving() {
    saveStatus.classList.add("saving");
    saveStatus.textContent = "儲存中…";
  }

  // ---------- 自動儲存（debounce） ----------
  var saveTimer = null;
  function scheduleSave() {
    flashSaving();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var rec = currentRecord();
      rec.data = collectFormData();
      rec.updatedAt = nowStr();
      persist();
      renderMeta();
      flashSaved();
    }, 400);
  }

  // ---------- 動作 ----------
  function switchRecord(id) {
    state.currentId = id;
    fillForm(currentRecord().data);
    renderMeta();
    persist();
    flashSaved();
  }

  function actionNew() {
    var name = prompt("新規格表名稱：", "規格表 " + (state.records.length + 1));
    if (name === null) return;
    name = name.trim() || ("規格表 " + (state.records.length + 1));
    var rec = newRecord(name);
    state.records.push(rec);
    state.currentId = rec.id;
    fillForm({});
    renderRecordSelect();
    renderMeta();
    persist();
    flashSaved();
  }

  function actionRename() {
    var rec = currentRecord();
    var name = prompt("重新命名：", rec.name);
    if (name === null) return;
    rec.name = name.trim() || rec.name;
    renderRecordSelect();
    renderMeta();
    persist();
  }

  function actionDuplicate() {
    var rec = currentRecord();
    var copy = newRecord(rec.name + "（複製）");
    copy.data = JSON.parse(JSON.stringify(rec.data));
    state.records.push(copy);
    state.currentId = copy.id;
    renderRecordSelect();
    renderMeta();
    persist();
    flashSaved();
  }

  function actionDelete() {
    if (state.records.length <= 1) {
      alert("至少要保留一份規格表，無法刪除最後一份。");
      return;
    }
    var rec = currentRecord();
    if (!confirm("確定刪除「" + rec.name + "」？此動作無法復原。")) return;
    state.records = state.records.filter(function (r) { return r.id !== rec.id; });
    state.currentId = state.records[0].id;
    fillForm(currentRecord().data);
    renderRecordSelect();
    renderMeta();
    persist();
  }

  function actionExport() {
    var rec = currentRecord();
    var payload = {
      type: "justplus-mold-spec",
      version: 1,
      exportedAt: nowStr(),
      record: { name: rec.name, data: rec.data, updatedAt: rec.updatedAt }
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = safeFileName(rec.name) + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function actionImport() { importFile.click(); }

  function handleImportFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var recData, recName;
        if (parsed && parsed.record) {        // 本工具匯出的格式
          recData = parsed.record.data || {};
          recName = parsed.record.name || "匯入的規格表";
        } else if (parsed && parsed.data) {    // 寬鬆：直接給 {name,data}
          recData = parsed.data; recName = parsed.name || "匯入的規格表";
        } else {                                // 寬鬆：整包就是欄位
          recData = parsed; recName = "匯入的規格表";
        }
        var rec = newRecord(recName + "（匯入）");
        rec.data = recData;
        state.records.push(rec);
        state.currentId = rec.id;
        fillForm(rec.data);
        renderRecordSelect();
        renderMeta();
        persist();
        flashSaved();
        alert("匯入成功：" + rec.name);
      } catch (e) {
        alert("匯入失敗：檔案格式不正確。");
      }
    };
    reader.readAsText(file);
  }

  function safeFileName(s) {
    return (s || "mold-spec").replace(/[\\/:*?"<>|]+/g, "_").trim() || "mold-spec";
  }

  function actionPdf() {
    // 先強制存一次，確保列印內容是最新的
    var rec = currentRecord();
    rec.data = collectFormData();
    rec.updatedAt = nowStr();
    persist();
    renderMeta();
    window.print();
  }

  // ---------- 綁定 ----------
  form.addEventListener("input", scheduleSave);
  form.addEventListener("change", scheduleSave);
  recordSelect.addEventListener("change", function () { switchRecord(recordSelect.value); });
  importFile.addEventListener("change", function () {
    if (importFile.files && importFile.files[0]) handleImportFile(importFile.files[0]);
    importFile.value = "";
  });

  document.querySelectorAll("[data-action]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      switch (btn.getAttribute("data-action")) {
        case "new": actionNew(); break;
        case "rename": actionRename(); break;
        case "duplicate": actionDuplicate(); break;
        case "delete": actionDelete(); break;
        case "export": actionExport(); break;
        case "import": actionImport(); break;
        case "pdf": actionPdf(); break;
      }
    });
  });

  // Ctrl/Cmd+P 也先存一次
  window.addEventListener("beforeprint", function () {
    var rec = currentRecord();
    rec.data = collectFormData();
    rec.updatedAt = nowStr();
    persist();
  });

  // ---------- 初始化 ----------
  renderRecordSelect();
  fillForm(currentRecord().data);
  renderMeta();
  flashSaved();
})();
