(() => {
  "use strict";

  const MAX_FILE_BYTES = 4 * 1024 * 1024;
  const MAX_TEXT_CHARS = 6000;
  const ALLOWED_IMAGES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
  const QUIZ_LETTERS = ["A", "B", "C", "D"];

  const authShell = document.querySelector("#auth-shell");
  const appShell = document.querySelector("#app-shell");
  const accountBar = document.querySelector("#account-bar");
  const accountName = document.querySelector("#account-name");
  const logoutButton = document.querySelector("#logout-button");
  const authForm = document.querySelector("#auth-form");
  const usernameInput = document.querySelector("#username");
  const passwordInput = document.querySelector("#password");
  const authSubmit = document.querySelector("#auth-submit");
  const authStatus = document.querySelector("#auth-status");
  const authHelp = document.querySelector("#auth-help");
  const loginTab = document.querySelector("#login-tab");
  const signupTab = document.querySelector("#signup-tab");
  const topicInput = document.querySelector("#topic");
  const fileInput = document.querySelector("#file-input");
  const attachButton = document.querySelector("#attach-button");
  const fileLabel = document.querySelector("#file-label");
  const removeFileButton = document.querySelector("#remove-file");
  const explainButton = document.querySelector("#explain-button");
  const explainLabel = document.querySelector("#explain-label");
  const status = document.querySelector("#status");
  const results = document.querySelector("#results");
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".answer-panel"));
  const simpleAnswer = document.querySelector("#simple-answer");
  const analogyAnswer = document.querySelector("#analogy-answer");
  const stepList = document.querySelector("#step-list");
  const quizQuestion = document.querySelector("#quiz-question");
  const quizOptions = document.querySelector("#quiz-options");
  const quizFeedback = document.querySelector("#quiz-feedback");
  const sessionCount = document.querySelector("#session-count");
  const copyButton = document.querySelector("#copy-button");
  const copyStatus = document.querySelector("#copy-status");
  const printButton = document.querySelector("#print-button");
  const printNotes = document.querySelector("#print-notes");
  const handwritingButton = document.querySelector("#handwriting-button");
  const handwritingPanel = document.querySelector("#handwriting-panel");
  const fontSelect = document.querySelector("#font-select");
  const generateNoteButton = document.querySelector("#generate-note");
  const notePreview = document.querySelector("#note-preview");
  const downloadNote = document.querySelector("#download-note");
  const historyToggle = document.querySelector("#history-toggle");
  const historyPanel = document.querySelector("#history-panel");
  const historyStatus = document.querySelector("#history-status");
  const historyList = document.querySelector("#history-list");
  const historyCount = document.querySelector("#history-count");
  const clearHistoryButton = document.querySelector("#clear-history");

  let attachment = null;
  let result = null;
  let explainCount = 0;
  let isLoading = false;
  let authMode = "login";

  function setStatus(message, kind = "") {
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function showAuthenticatedUser(user) {
    authShell.hidden = true;
    appShell.hidden = false;
    accountBar.hidden = false;
    accountName.textContent = user.username;
    authStatus.textContent = "";
    loadHistory();
  }

  function showSignIn(message = "") {
    appShell.hidden = true;
    accountBar.hidden = true;
    authShell.hidden = false;
    setAuthMode("login");
    authStatus.textContent = message;
    passwordInput.value = "";
    historyList.replaceChildren();
    historyPanel.hidden = true;
    historyToggle.setAttribute("aria-expanded", "false");
    historyCount.textContent = "Recent conversations";
    historyStatus.textContent = "";
    clearHistoryButton.disabled = true;
    result = null;
    topicInput.value = "";
    attachment = null;
    fileInput.value = "";
    fileLabel.textContent = "";
    removeFileButton.hidden = true;
    results.hidden = true;
    printNotes.replaceChildren();
    updateExplainButton();
  }

  function setAuthMode(mode) {
    authMode = mode;
    const signingUp = mode === "signup";
    loginTab.classList.toggle("is-active", !signingUp);
    signupTab.classList.toggle("is-active", signingUp);
    loginTab.setAttribute("aria-selected", String(!signingUp));
    signupTab.setAttribute("aria-selected", String(signingUp));
    loginTab.tabIndex = signingUp ? -1 : 0;
    signupTab.tabIndex = signingUp ? 0 : -1;
    authSubmit.textContent = signingUp ? "Create account" : "Sign in";
    passwordInput.autocomplete = signingUp ? "new-password" : "current-password";
    passwordInput.minLength = signingUp ? 10 : 1;
    authHelp.textContent = signingUp
      ? "Usernames use 3–24 letters, numbers, dots, dashes, or underscores. Passwords must be at least 10 characters."
      : "Use your Tutor.AI username and password.";
    authStatus.textContent = "";
  }

  function apiEndpoint(path) {
    if (window.location.protocol === "file:") {
      throw new Error("You opened index.html directly. Tutor.AI accounts need the backend: run npm start from the tutor-ai folder, then open http://localhost:3000.");
    }
    const configured = typeof window.TUTOR_API_BASE_URL === "string" ? window.TUTOR_API_BASE_URL.trim() : "";
    if (!configured) {
      const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
      if (window.location.protocol !== "https:" && !local) {
        throw new Error("Tutor.AI requires a secure HTTPS connection.");
      }
      return new URL(`/api/${path}`, window.location.href).href;
    }
    let base;
    try {
      base = new URL(configured);
    } catch {
      throw new Error("Tutor API setup is invalid. Check tutor-config.js.");
    }
    if (base.protocol !== "https:" && base.hostname !== "localhost" && base.hostname !== "127.0.0.1") {
      throw new Error("Tutor API must use HTTPS. Check tutor-config.js.");
    }
    if (base.origin !== configured) throw new Error("Set only the Tutor API origin in tutor-config.js (no path or trailing slash).");
    return new URL(`/api/${path}`, base).href;
  }

  async function apiRequest(path, options = {}) {
    const endpoint = apiEndpoint(path);
    let response;
    try {
      response = await fetch(endpoint, { ...options, credentials: "include" });
    } catch {
      throw new Error("Could not connect to Tutor.AI. Check your connection and try again.");
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Tutor service returned an invalid response.");
    }
    if (!response.ok) {
      const error = new Error(typeof data.error === "string" ? data.error : "Tutor service could not complete the request.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function submitAuth(event) {
    event.preventDefault();
    authSubmit.disabled = true;
    authStatus.textContent = "";
    try {
      const data = await apiRequest(`auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput.value, password: passwordInput.value })
      });
      passwordInput.value = "";
      showAuthenticatedUser(data.user);
      topicInput.focus();
    } catch (error) {
      authStatus.textContent = error instanceof Error ? error.message : "Could not sign in. Please try again.";
    } finally {
      authSubmit.disabled = false;
    }
  }

  async function initializeAuth() {
    try {
      const data = await apiRequest("auth/me");
      if (data.user) showAuthenticatedUser(data.user);
    } catch (error) {
      authStatus.textContent = error instanceof Error ? error.message : "Tutor.AI is unavailable.";
    }
  }

  async function signOut() {
    logoutButton.disabled = true;
    try {
      await apiRequest("auth/logout", { method: "POST" });
      historyList.replaceChildren();
      showSignIn("You have signed out.");
      usernameInput.focus();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sign out.", "error");
    } finally {
      logoutButton.disabled = false;
    }
  }

  function historyDate(timestamp) {
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  async function openConversation(id) {
    historyStatus.textContent = "Loading conversation…";
    try {
      const conversation = await apiRequest(`history/${encodeURIComponent(id)}`);
      result = conversation.answer;
      topicInput.value = conversation.question;
      attachment = null;
      fileInput.value = "";
      fileLabel.textContent = "";
      removeFileButton.hidden = true;
      updateExplainButton();
      renderResult(result);
      results.hidden = false;
      activateTab("simple");
      updatePrintNotes();
      historyStatus.textContent = conversation.question
        ? `Opened “${conversation.title}”.`
        : "Previous answer loaded. The original attachment is not saved; add it again to ask a follow-up.";
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (error.status === 401) {
        showSignIn("Your session expired. Sign in again to continue.");
        return;
      }
      historyStatus.textContent = error instanceof Error ? error.message : "Could not load that conversation.";
    }
  }

  async function loadHistory() {
    historyStatus.textContent = "Loading history…";
    try {
      const data = await apiRequest("history");
      historyList.replaceChildren();
      historyCount.textContent = `${data.conversations.length} recent conversation${data.conversations.length === 1 ? "" : "s"}`;
      clearHistoryButton.disabled = data.conversations.length === 0;
      if (!data.conversations.length) {
        historyStatus.textContent = "Your conversations will appear here after you ask Tutor.AI a question.";
        return;
      }
      historyStatus.textContent = "";
      data.conversations.forEach(conversation => {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.className = "history-item";
        button.type = "button";
        const title = document.createElement("span");
        title.className = "history-item-title";
        title.textContent = conversation.title;
        const date = document.createElement("time");
        date.className = "history-item-date";
        date.dateTime = new Date(conversation.createdAt).toISOString();
        date.textContent = historyDate(conversation.createdAt);
        button.append(title, date);
        button.addEventListener("click", () => openConversation(conversation.id));
        item.append(button);
        historyList.append(item);
      });
    } catch (error) {
      historyList.replaceChildren();
      if (error.status === 401) {
        showSignIn("Your session expired. Sign in again to continue.");
        return;
      }
      historyStatus.textContent = error instanceof Error ? error.message : "Could not load history.";
    }
  }

  async function clearHistory() {
    if (!window.confirm("Clear all of your saved conversations? This cannot be undone.")) return;
    clearHistoryButton.disabled = true;
    historyStatus.textContent = "Clearing history…";
    try {
      await apiRequest("history", { method: "DELETE" });
      historyList.replaceChildren();
      historyCount.textContent = "0 recent conversations";
      historyStatus.textContent = "Your conversation history has been cleared.";
    } catch (error) {
      historyStatus.textContent = error instanceof Error ? error.message : "Could not clear history.";
      if (error.status === 401) {
        showSignIn("Your session expired. Sign in again to continue.");
        return;
      }
      clearHistoryButton.disabled = false;
    }
  }

  function updateExplainButton() {
    explainButton.disabled = isLoading || (!topicInput.value.trim() && !attachment);
  }

  function readBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || "");
        const separator = value.indexOf(",");
        if (separator < 0) {
          reject(new Error("This file could not be read."));
          return;
        }
        resolve(value.slice(separator + 1));
      };
      reader.onerror = () => reject(new Error("This file could not be read."));
      reader.readAsDataURL(file);
    });
  }

  function extensionOf(name) {
    const dot = name.lastIndexOf(".");
    return dot < 0 ? "" : name.slice(dot).toLowerCase();
  }

  async function extractDocxText(file) {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const minimum = Math.max(0, bytes.length - 65557);
    let endOffset = -1;

    for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        endOffset = offset;
        break;
      }
    }

    if (endOffset < 0 || view.getUint16(endOffset + 4, true) !== 0 || view.getUint16(endOffset + 6, true) !== 0) {
      throw new Error("That Word document is not a supported DOCX file.");
    }

    const diskEntryCount = view.getUint16(endOffset + 8, true);
    const entryCount = view.getUint16(endOffset + 10, true);
    const directorySize = view.getUint32(endOffset + 12, true);
    const directoryOffset = view.getUint32(endOffset + 16, true);
    if (diskEntryCount !== entryCount || entryCount > 1024 || directoryOffset + directorySize > endOffset) {
      throw new Error("That Word document has an invalid file structure.");
    }

    let cursor = directoryOffset;
    let documentEntry = null;
    const decoder = new TextDecoder();

    for (let index = 0; index < entryCount; index += 1) {
      if (cursor + 46 > directoryOffset + directorySize || view.getUint32(cursor, true) !== 0x02014b50) {
        throw new Error("That Word document has an invalid file structure.");
      }

      const flags = view.getUint16(cursor + 8, true);
      const method = view.getUint16(cursor + 10, true);
      const compressedSize = view.getUint32(cursor + 20, true);
      const uncompressedSize = view.getUint32(cursor + 24, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const localOffset = view.getUint32(cursor + 42, true);
      const recordLength = 46 + nameLength + extraLength + commentLength;
      if (cursor + recordLength > directoryOffset + directorySize) {
        throw new Error("That Word document has an invalid file structure.");
      }

      const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
      if (name === "word/document.xml") {
        documentEntry = { flags, method, compressedSize, uncompressedSize, localOffset };
      }
      cursor += recordLength;
    }

    if (!documentEntry || documentEntry.flags & 1 || ![0, 8].includes(documentEntry.method)) {
      throw new Error("That Word document uses an unsupported format.");
    }
    if (documentEntry.uncompressedSize > 2 * 1024 * 1024 ||
        documentEntry.compressedSize > bytes.length ||
        (documentEntry.compressedSize === 0 && documentEntry.uncompressedSize > 0) ||
        (documentEntry.compressedSize > 0 && documentEntry.uncompressedSize / documentEntry.compressedSize > 100)) {
      throw new Error("That Word document is too large to safely read.");
    }

    const local = documentEntry.localOffset;
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) {
      throw new Error("That Word document has an invalid file structure.");
    }
    const dataOffset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const dataEnd = dataOffset + documentEntry.compressedSize;
    if (dataEnd > bytes.length) throw new Error("That Word document has an invalid file structure.");

    let xmlBytes = bytes.slice(dataOffset, dataEnd);
    if (documentEntry.method === 8) {
      if (typeof DecompressionStream !== "function") {
        throw new Error("DOCX reading is not available in this browser. Save the document as PDF or TXT instead.");
      }
      try {
        const stream = new Blob([xmlBytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        const reader = stream.getReader();
        const chunks = [];
        let expandedSize = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          expandedSize += value.byteLength;
          if (expandedSize > documentEntry.uncompressedSize || expandedSize > 2 * 1024 * 1024) {
            await reader.cancel();
            throw new Error("Expanded DOCX content exceeded its declared size.");
          }
          chunks.push(value);
        }
        xmlBytes = new Uint8Array(expandedSize);
        let offset = 0;
        for (const chunk of chunks) {
          xmlBytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
      } catch {
        throw new Error("That Word document could not be safely opened. Save it as PDF or TXT instead.");
      }
    }
    if (xmlBytes.length !== documentEntry.uncompressedSize || xmlBytes.length > 2 * 1024 * 1024) {
      throw new Error("That Word document has an invalid document size.");
    }

    let xmlText;
    try {
      xmlText = new TextDecoder("utf-8", { fatal: true }).decode(xmlBytes);
    } catch {
      throw new Error("That Word document contains invalid text.");
    }
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("That Word document contains invalid text.");
    const wordNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    return Array.from(xml.getElementsByTagNameNS(wordNamespace, "p"))
      .map(paragraph => Array.from(paragraph.getElementsByTagNameNS(wordNamespace, "t"))
        .map(node => node.textContent || "")
        .join(""))
      .filter(Boolean)
      .join("\n")
      .slice(0, MAX_TEXT_CHARS);
  }

  async function loadAttachment(file) {
    setStatus("");
    attachment = null;
    fileLabel.textContent = "";
    removeFileButton.hidden = true;
    if (!file) {
      updateExplainButton();
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setStatus("Choose a file smaller than 4 MB.", "error");
      fileInput.value = "";
      updateExplainButton();
      return;
    }

    const extension = extensionOf(file.name);
    try {
      if (ALLOWED_IMAGES.has(file.type)) {
        attachment = { kind: "image", mediaType: file.type, data: await readBase64(file) };
      } else if (file.type === "application/pdf" || extension === ".pdf") {
        attachment = { kind: "pdf", mediaType: "application/pdf", data: await readBase64(file) };
      } else if (file.type === "text/plain" || extension === ".txt") {
        const text = (await file.text()).slice(0, MAX_TEXT_CHARS);
        if (!text.trim()) throw new Error("That text file is empty.");
        attachment = { kind: "text", text };
      } else if (extension === ".docx") {
        const text = await extractDocxText(file);
        if (!text.trim()) throw new Error("No readable text was found in that Word document.");
        attachment = { kind: "text", text };
      } else {
        throw new Error("Use a PNG, JPEG, GIF, WebP, PDF, DOCX, or TXT file.");
      }
      fileLabel.textContent = file.name;
      fileLabel.title = file.name;
      removeFileButton.hidden = false;
      updateExplainButton();
    } catch (error) {
      attachment = null;
      setStatus(error instanceof Error ? error.message : "This file could not be read.", "error");
      fileInput.value = "";
      updateExplainButton();
    }
  }

  function validResponse(value) {
    return value &&
      typeof value.simple === "string" &&
      Boolean(value.simple.trim()) &&
      typeof value.analogy === "string" &&
      Boolean(value.analogy.trim()) &&
      Array.isArray(value.steps) &&
      value.steps.length >= 1 &&
      value.steps.length <= 10 &&
      value.steps.every(step => typeof step === "string" && step.trim()) &&
      value.quiz &&
      typeof value.quiz.question === "string" &&
      Boolean(value.quiz.question.trim()) &&
      Array.isArray(value.quiz.options) &&
      value.quiz.options.length === 4 &&
      value.quiz.options.every(option => typeof option === "string" && option.trim()) &&
      Number.isInteger(value.quiz.correctIndex) &&
      value.quiz.correctIndex >= 0 &&
      value.quiz.correctIndex < 4 &&
      typeof value.quiz.explain === "string" &&
      Boolean(value.quiz.explain.trim());
  }

  async function requestExplanation() {
    if (isLoading || (!topicInput.value.trim() && !attachment)) return;
    isLoading = true;
    result = null;
    results.hidden = true;
    copyStatus.textContent = "";
    setStatus("Putting the pieces together…");
    explainLabel.textContent = "Thinking…";
    explainButton.setAttribute("aria-busy", "true");
    updateExplainButton();

    const payload = {
      topic: topicInput.value.trim(),
      title: topicInput.value.trim() || fileLabel.textContent || "Attached study material",
      attachment
    };

    try {
      const data = await apiRequest("explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!validResponse(data)) throw new Error("Tutor service returned an incomplete answer. Please try again.");
      result = data;
      explainCount += 1;
      renderResult(data);
      results.hidden = false;
      activateTab("simple");
      updatePrintNotes();
      setStatus("");
      loadHistory();
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (error.status === 401) {
        showSignIn("Your session expired. Sign in again to continue.");
        return;
      }
      setStatus(error instanceof Error ? error.message : "Couldn't get an explanation. Please try again.", "error");
    } finally {
      isLoading = false;
      explainLabel.textContent = "Explain this";
      explainButton.removeAttribute("aria-busy");
      updateExplainButton();
    }
  }

  function renderResult(value) {
    simpleAnswer.textContent = value.simple;
    analogyAnswer.textContent = value.analogy;
    stepList.replaceChildren();
    value.steps.forEach((step, index) => {
      const item = document.createElement("li");
      const number = document.createElement("span");
      number.className = "step-number";
      number.setAttribute("aria-hidden", "true");
      number.textContent = String(index + 1);
      const text = document.createElement("span");
      text.className = "step-text";
      text.textContent = step;
      item.append(number, text);
      stepList.append(item);
    });

    quizQuestion.textContent = value.quiz.question;
    quizOptions.replaceChildren();
    quizFeedback.textContent = "";
    quizFeedback.hidden = true;
    value.quiz.options.forEach((option, index) => {
      const button = document.createElement("button");
      button.className = "quiz-option";
      button.type = "button";
      const letter = document.createElement("span");
      letter.className = "quiz-letter";
      letter.textContent = QUIZ_LETTERS[index];
      const label = document.createElement("span");
      label.textContent = option;
      button.append(letter, label);
      button.addEventListener("click", () => selectQuizAnswer(button, index));
      quizOptions.append(button);
    });
    sessionCount.textContent = String(explainCount).padStart(2, "0");
    notePreview.hidden = true;
    downloadNote.hidden = true;
    handwritingPanel.hidden = true;
    handwritingButton.setAttribute("aria-expanded", "false");
  }

  function selectQuizAnswer(selectedButton, selectedIndex) {
    if (!result) return;
    const correct = selectedIndex === result.quiz.correctIndex;
    Array.from(quizOptions.children).forEach((button, index) => {
      button.disabled = true;
      if (index === result.quiz.correctIndex) button.dataset.state = "correct";
      else if (index === selectedIndex) button.dataset.state = "wrong";
    });
    quizFeedback.textContent = `${correct ? "That’s it!" : "Not quite."} ${result.quiz.explain}`;
    quizFeedback.hidden = false;
    selectedButton.setAttribute("aria-pressed", "true");
  }

  function activateTab(id) {
    tabs.forEach(tab => {
      const selected = tab.dataset.tab === id;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => {
      panel.hidden = panel.id !== `panel-${id}`;
    });
  }

  function buildNotesText() {
    if (!result) return "";
    const lines = [
      "TUTOR.AI — STUDY NOTES",
      "",
      "PLAIN ENGLISH",
      result.simple,
      "",
      "THE ANALOGY",
      result.analogy,
      "",
      "STEP BY STEP",
      ...result.steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "QUICK QUIZ",
      result.quiz.question,
      ...result.quiz.options.map((option, index) =>
        `${QUIZ_LETTERS[index]}. ${option}${index === result.quiz.correctIndex ? " (correct)" : ""}`),
      result.quiz.explain
    ];
    return lines.join("\n");
  }

  function updatePrintNotes() {
    printNotes.replaceChildren();
    const heading = document.createElement("h1");
    heading.textContent = topicInput.value.trim() || fileLabel.textContent || "Study notes";
    const content = document.createElement("div");
    content.textContent = buildNotesText();
    printNotes.append(heading, content);
  }

  async function copyNotes() {
    if (!result) return;
    copyStatus.textContent = "";
    try {
      await navigator.clipboard.writeText(buildNotesText());
      copyStatus.textContent = "Notes copied.";
    } catch {
      const helper = document.createElement("textarea");
      helper.value = buildNotesText();
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.append(helper);
      helper.select();
      const copied = document.execCommand("copy");
      helper.remove();
      copyStatus.textContent = copied ? "Notes copied." : "Copy was blocked. Select the answer text and copy it manually.";
    }
  }

  function wrapCanvasText(context, text, maxWidth) {
    const lines = [];
    for (const paragraph of text.split("\n")) {
      if (!paragraph) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && context.measureText(next).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  function generateNoteCard() {
    if (!result) return;
    const canvas = document.createElement("canvas");
    const width = 1000;
    const lineHeight = 46;
    const context = canvas.getContext("2d");
    if (!context) {
      setStatus("Your browser could not create the note card.", "error");
      return;
    }

    const noteText = buildNotesText().slice(0, 8000);
    const fonts = {
      cursive: "'Segoe Print', 'Bradley Hand', cursive",
      comic: "'Comic Sans MS', 'Trebuchet MS', cursive",
      serif: "Georgia, serif"
    };
    const font = fonts[fontSelect.value] || fonts.cursive;
    context.font = `30px ${font}`;
    let lines = wrapCanvasText(context, noteText, width - 190);
    if (lines.length > 125) lines = [...lines.slice(0, 124), "…"];
    const height = Math.max(1100, 220 + lines.length * lineHeight);
    canvas.width = width;
    canvas.height = height;
    const paint = canvas.getContext("2d");
    if (!paint) {
      setStatus("Your browser could not create the note card.", "error");
      return;
    }
    paint.fillStyle = "#fffdf6";
    paint.fillRect(0, 0, width, height);
    paint.strokeStyle = "rgba(203, 108, 117, .38)";
    paint.lineWidth = 2;
    paint.beginPath();
    paint.moveTo(92, 0);
    paint.lineTo(92, height);
    paint.stroke();
    paint.strokeStyle = "rgba(118, 144, 188, .24)";
    paint.lineWidth = 1;
    for (let y = 145; y < height; y += lineHeight) {
      paint.beginPath();
      paint.moveTo(55, y);
      paint.lineTo(width - 35, y);
      paint.stroke();
    }
    paint.fillStyle = "#29254c";
    paint.font = `bold 43px ${font}`;
    paint.fillText((topicInput.value.trim() || fileLabel.textContent || "My study notes").slice(0, 42), 115, 96);
    paint.font = `30px ${font}`;
    lines.forEach((line, index) => paint.fillText(line, 115, 195 + index * lineHeight));

    const image = canvas.toDataURL("image/png");
    notePreview.src = image;
    notePreview.hidden = false;
    downloadNote.href = image;
    downloadNote.hidden = false;
    setStatus("Your note card is ready.");
  }

  loginTab.addEventListener("click", () => setAuthMode("login"));
  signupTab.addEventListener("click", () => setAuthMode("signup"));
  [loginTab, signupTab].forEach((tab, index, allTabs) => {
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? allTabs.length - 1 :
        (index + (event.key === "ArrowRight" ? 1 : -1) + allTabs.length) % allTabs.length;
      allTabs[next].focus();
      setAuthMode(next === 0 ? "login" : "signup");
    });
  });
  authForm.addEventListener("submit", submitAuth);
  logoutButton.addEventListener("click", signOut);
  historyToggle.addEventListener("click", () => {
    const opening = historyPanel.hidden;
    historyPanel.hidden = !opening;
    historyToggle.setAttribute("aria-expanded", String(opening));
    if (opening) loadHistory();
  });
  clearHistoryButton.addEventListener("click", clearHistory);
  topicInput.addEventListener("input", updateExplainButton);
  topicInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) requestExplanation();
  });
  attachButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => loadAttachment(fileInput.files?.[0]));
  removeFileButton.addEventListener("click", () => {
    attachment = null;
    fileInput.value = "";
    fileLabel.textContent = "";
    fileLabel.removeAttribute("title");
    removeFileButton.hidden = true;
    setStatus("");
    updateExplainButton();
  });
  explainButton.addEventListener("click", requestExplanation);
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
        (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      activateTab(tabs[next].dataset.tab);
    });
  });
  copyButton.addEventListener("click", copyNotes);
  printButton.addEventListener("click", () => {
    updatePrintNotes();
    window.print();
  });
  handwritingButton.addEventListener("click", () => {
    const isOpen = handwritingPanel.hidden;
    handwritingPanel.hidden = !isOpen;
    handwritingButton.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) handwritingPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  generateNoteButton.addEventListener("click", generateNoteCard);

  updateExplainButton();
  initializeAuth();
})();
