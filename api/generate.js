// Firebase Imports (Authentication & Database အတွက် မူလအတိုင်း ထားရှိပါသည်)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, initializeFirestore, doc, getDoc, setDoc, addDoc, collection, onSnapshot, query, orderBy, updateDoc, deleteDoc, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global Variables
let ui, templates;
let uploadedImageBase64 = null;
let app, db, auth, userId;
let stylebookCache = new Map();
let moodBoardStylebookCache = new Map();
let projectStylebookCache = new Map();
let currentMoodBoardConcepts = []; 
let currentProjectData = null;
let currentEditingData = null;

// Tab State
const TabState = {
    lighting: { analysis: null, chatHistory: [] },
    editing: { data: null, chatHistory: [] },
    posing: { poses: null },
    moodboard: { concepts: null },
    client: { message: null, checklist: null },
};

// --- CORE API HANDLER (NEW BACKEND) ---
// အစ်ကိုပေးထားသော ကုဒ်ဖြင့် အစားထိုးထားသည့် အဓိက Function ဖြစ်ပါသည်
async function callAI(promptText) {
    try {
        console.log("Sending prompt to AI Backend...");
        const res = await fetch("https://ai-backend-lovat-beta.vercel.app/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptText })
        });

        if (!res.ok) {
            throw new Error(`Server Error: ${res.status}`);
        }

        const data = await res.json();
        
        // Backend မှ ပြန်လာမည့် response format ကို ကိုက်ညီအောင် ယူပါမည်
        // များသောအားဖြင့် { result: "..." } သို့မဟုတ် { text: "..." } ဖြစ်တတ်သည်
        // ဤနေရာတွင် text string ပြန်ရရန် ယူဆထားပါသည်
        const responseText = data.result || data.text || data.response || data.answer || (typeof data === 'string' ? data : JSON.stringify(data));
        
        return responseText;

    } catch (error) {
        console.error("AI API Error:", error);
        throw error;
    }
}

// Helper: Clean JSON String (Markdown များကို ဖယ်ရှားရန်)
function cleanJsonString(jsonString) {
    if (!jsonString) return "";
    return jsonString.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
}

// --- APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initializeAppAndAuth();
    initializeUI();
    setupEventListeners();
    
    // Default Tab Loading
    const savedTab = localStorage.getItem('activeTab') || 'studio';
    const tabBtn = document.querySelector(`button[data-tab="${savedTab}"]`);
    if (tabBtn) tabBtn.click();
});

function initializeUI() {
    ui = {
        // Auth
        loginSection: document.getElementById('login-section'),
        appContainer: document.getElementById('app-container'),
        emailInput: document.getElementById('email'),
        passwordInput: document.getElementById('password'),
        loginBtn: document.getElementById('login-btn'),
        loginBtnText: document.getElementById('login-btn-text'),
        loginLoader: document.getElementById('login-loader'),
        logoutBtn: document.getElementById('logout-btn'),

        // Creative Studio
        topic: document.getElementById('topic'),
        serviceType: document.getElementById('serviceType'),
        contentTemplate: document.getElementById('contentTemplate'),
        generateBtn: document.getElementById('generateBtn'),
        btnText: document.getElementById('btn-text'),
        loader: document.getElementById('loader'),
        outputContainer: document.getElementById('output-container'),
        outputSection: document.getElementById('output-section'),
        imageUploadInput: document.getElementById('image-upload'),
        imagePreviewContainer: document.getElementById('image-preview-container'),
        imagePreview: document.getElementById('image-preview'),
        removeImageBtn: document.getElementById('remove-image-btn'),
        imagePrompt: document.getElementById('image-prompt'),
        
        // Ideas
        ideaBtn: document.getElementById('ideaBtn'),
        ideaLoader: document.getElementById('ideaLoader'),
        ideaSuggestionContainer: document.getElementById('idea-suggestion-container'),

        // Lighting
        lightingGoalInput: document.getElementById('lighting-goal'),
        generateSetupBtn: document.getElementById('generate-setup-btn'),
        analyzeLightingBtn: document.getElementById('analyze-lighting-btn'),
        analyzeBtnText: document.getElementById('analyze-btn-text'),
        analyzeLoader: document.getElementById('analyze-loader'),
        lightingOutputSection: document.getElementById('lighting-output-section'),
        lightingOutputContainer: document.getElementById('lighting-output-container'),
        stylebookContainer: document.getElementById('stylebook-container'),
        stylebookPlaceholder: document.getElementById('stylebook-placeholder'),
        lightingChatInput: document.getElementById('lighting-chat-input'),
        lightingChatSendBtn: document.getElementById('lighting-chat-send'),
        lightingChatHistory: document.getElementById('lighting-chat-history'),

        // Planner
        plannerGoal: document.getElementById('planner-goal'),
        plannerFocus: document.getElementById('planner-focus'),
        plannerPosts: document.getElementById('planner-posts'),
        generatePlannerBtn: document.getElementById('generate-planner-btn'),
        generatePlannerBtnText: document.getElementById('generate-planner-btn-text'),
        generatePlannerLoader: document.getElementById('generate-planner-loader'),
        plannerOutputSection: document.getElementById('planner-output-section'),
        plannerOutputContainer: document.getElementById('planner-output-container'),

        // Posing
        posingCategory: document.getElementById('posing-category'),
        posingGoal: document.getElementById('posing-goal'),
        getPosesBtn: document.getElementById('get-poses-btn'),
        posingOutputSection: document.getElementById('posing-output-section'),
        posingOutputContainer: document.getElementById('posing-output-container'),

        // Editing
        editingStyleInput: document.getElementById('editing-style-input'),
        getEditingStepsBtn: document.getElementById('get-editing-steps-btn'),
        editingOutputSection: document.getElementById('editing-output-section'),
        editingOutputContainer: document.getElementById('editing-output-container'),
        editingChatInput: document.getElementById('editing-chat-input'),
        editingChatSendBtn: document.getElementById('editing-chat-send'),
        editingChatHistory: document.getElementById('editing-chat-history'),

        // Director
        projectNameInput: document.getElementById('project-name'),
        creativeBriefInput: document.getElementById('creative-brief'),
        generatePlanBtn: document.getElementById('generate-plan-btn'),
        directorOutputSection: document.getElementById('director-output-section'),
        projectDashboardTitle: document.getElementById('project-dashboard-title'),
        projectDashboardContainer: document.getElementById('project-dashboard-container'),
        
        // Notifications
        notification: document.getElementById('notification'),
        notificationMessage: document.getElementById('notification-message'),
        
        // Settings (For Brand Brain)
        brandVoiceModal: document.getElementById('brand-voice-modal'),
        brandDescription: document.getElementById('brand-description'),
        brandSamples: document.getElementById('brand-samples'),
        brandRules: document.getElementById('brand-rules'),
        saveBrandVoiceBtn: document.getElementById('save-brand-voice-btn'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        
        // Modals
        saveLightingModal: document.getElementById('save-lighting-modal'),
        setupNameInput: document.getElementById('setup-name'),
        setupTagsInput: document.getElementById('setup-tags'),
        setupGearInput: document.getElementById('setup-gear'),
        cancelSaveLightingBtn: document.getElementById('cancel-save-lighting'),
        confirmSaveLightingBtn: document.getElementById('confirm-save-lighting'),
        editingSetupId: document.getElementById('editing-setup-id'),
        
        saveProjectModal: document.getElementById('save-project-modal'),
        projectModalNameInput: document.getElementById('project-modal-name'),
        projectModalTagsInput: document.getElementById('project-modal-tags'),
        cancelSaveProjectBtn: document.getElementById('cancel-save-project'),
        confirmSaveProjectBtn: document.getElementById('confirm-save-project'),
        editingProjectId: document.getElementById('editing-project-id'),
        
        deleteConfirmModal: document.getElementById('delete-confirm-modal'),
        deleteItemName: document.getElementById('delete-item-name'),
        confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
        cancelDeleteBtn: document.getElementById('cancel-delete-btn'),

        // Projects Tab
        projectStylebookContainer: document.getElementById('project-stylebook-container'),
        projectStylebookPlaceholder: document.getElementById('project-stylebook-placeholder')
    };

    // Populate Dynamic Content
    populateCreativeAssistantTools();
    populateContentFormats();
    renderPresetGalleries();
    setupMobileMenu();
}

function setupEventListeners() {
    if(ui.loginBtn) ui.loginBtn.addEventListener('click', handleLogin);
    if(ui.logoutBtn) ui.logoutBtn.addEventListener('click', handleLogout);
    
    // Tab Switching
    document.querySelectorAll('.tab-btn-desktop, .tab-btn-mobile').forEach(btn => 
        btn.addEventListener('click', handleTabSwitch));

    // Creative Studio
    if(ui.generateBtn) ui.generateBtn.addEventListener('click', generateContent);
    if(ui.ideaBtn) ui.ideaBtn.addEventListener('click', getPostIdeas);
    if(ui.contentTemplate) ui.contentTemplate.addEventListener('change', applyContentTemplate);
    if(ui.imageUploadInput) ui.imageUploadInput.addEventListener('change', handleImageUpload);
    if(ui.removeImageBtn) ui.removeImageBtn.addEventListener('click', removeImage);

    // Lighting
    if(ui.generateSetupBtn) ui.generateSetupBtn.addEventListener('click', () => {
        const goal = ui.lightingGoalInput.value.trim();
        if(goal) analyzeLighting(null, goal);
    });
    if(ui.analyzeLightingBtn) ui.analyzeLightingBtn.addEventListener('click', () => analyzeLighting(null, "Analyze the lighting based on uploaded photo description")); // Text fallback for image
    if(ui.lightingChatSendBtn) ui.lightingChatSendBtn.addEventListener('click', handleLightingChat);
    if(ui.confirmSaveLightingBtn) ui.confirmSaveLightingBtn.addEventListener('click', handleSaveOrUpdateSetup);
    if(ui.cancelSaveLightingBtn) ui.cancelSaveLightingBtn.addEventListener('click', () => ui.saveLightingModal.classList.add('hidden'));

    // Planner
    if(ui.generatePlannerBtn) ui.generatePlannerBtn.addEventListener('click', generateWeeklyPlan);

    // Posing
    if(ui.getPosesBtn) ui.getPosesBtn.addEventListener('click', getPoses);

    // Editing
    if(ui.getEditingStepsBtn) ui.getEditingStepsBtn.addEventListener('click', getEditingSteps);
    if(ui.editingChatSendBtn) ui.editingChatSendBtn.addEventListener('click', handleChromaChat);

    // Director
    if(ui.generatePlanBtn) ui.generatePlanBtn.addEventListener('click', generateProjectPlan);
    if(ui.projectDashboardContainer) ui.projectDashboardContainer.addEventListener('click', handleDirectorActionClick);
    
    // Brand Brain
    if(document.getElementById('set-brand-voice-btn')) {
        document.getElementById('set-brand-voice-btn').addEventListener('click', () => ui.brandVoiceModal.classList.remove('hidden'));
    }
    if(ui.closeModalBtn) ui.closeModalBtn.addEventListener('click', () => ui.brandVoiceModal.classList.add('hidden'));
    if(ui.saveBrandVoiceBtn) ui.saveBrandVoiceBtn.addEventListener('click', saveBrandVoice);

    // Projects Save
    if(ui.confirmSaveProjectBtn) ui.confirmSaveProjectBtn.addEventListener('click', handleSaveOrUpdateProject);
    if(ui.cancelSaveProjectBtn) ui.cancelSaveProjectBtn.addEventListener('click', () => ui.saveProjectModal.classList.add('hidden'));
    
    // Deletion
    if(ui.cancelDeleteBtn) ui.cancelDeleteBtn.addEventListener('click', () => ui.deleteConfirmModal.classList.add('hidden'));
    
    // Stylebook Clicks
    if(ui.stylebookContainer) ui.stylebookContainer.addEventListener('click', handleStylebookClick);
    if(ui.projectStylebookContainer) ui.projectStylebookContainer.addEventListener('click', handleProjectStylebookClick);
}

// --- AUTHENTICATION (FIREBASE) ---
function initializeAppAndAuth() {
    // Config from Environment or Fallback
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
        apiKey: "AIzaSyBEqE5lWdLWIZOO_M3RYY35e17VMTGk-G0",
        authDomain: "saiai-content-generator.firebaseapp.com",
        projectId: "saiai-content-generator",
        storageBucket: "saiai-content-generator.firebasestorage.app",
        messagingSenderId: "574947512372",
        appId: "1:574947512372:web:fc1c8eb3bb83d924493a61",
        measurementId: "G-YVDTQ01MR8"
    };
    app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, { experimentalForceLongPolling: true });
    auth = getAuth(app);

    onAuthStateChanged(auth, (user) => {
        if (user) {
            userId = user.uid;
            ui.loginSection.classList.add('hidden');
            ui.appContainer.classList.remove('hidden');
            ui.appContainer.classList.add('animate-fadeIn');
            loadBrandVoice();
        } else {
            userId = null;
            ui.loginSection.classList.remove('hidden');
            ui.appContainer.classList.add('hidden');
        }
    });
}

async function handleLogin() {
    const email = ui.emailInput.value;
    const password = ui.passwordInput.value;
    if (!email || !password) return showNotification("Please enter email and password", "error");

    ui.loginBtn.disabled = true;
    ui.loginBtnText.classList.add('hidden');
    ui.loginLoader.classList.remove('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification("Login Successful!", "success");
    } catch (error) {
        showNotification(error.message, "error");
    } finally {
        ui.loginBtn.disabled = false;
        ui.loginBtnText.classList.remove('hidden');
        ui.loginLoader.classList.add('hidden');
    }
}

async function handleLogout() {
    await signOut(auth);
}

// --- CREATIVE STUDIO LOGIC ---
async function generateContent() {
    const topic = ui.topic.value.trim();
    if (!topic && !uploadedImageBase64) return showNotification("Please enter a topic.", "error");

    setLoading(true, 'generate');

    // Collect Inputs
    const persona = document.getElementById('persona')?.value || 'default';
    const tone = document.getElementById('tone')?.value || 'professional';
    const length = document.getElementById('length')?.value || 'medium';
    const selectedFormats = Array.from(document.querySelectorAll('input[name="content-format"]:checked')).map(cb => cb.value);
    
    // Build Prompt
    const systemPrompt = `ROLE: Creative Content Strategist for a Myanmar Photo Studio. 
    TASK: Generate social media content.
    Language: Burmese (Myanmar).
    Persona: ${persona}. Tone: ${tone}. Length: ${length}.
    Formats: ${selectedFormats.join(', ')}.
    
    IMPORTANT: Return ONLY a valid JSON object with keys matching the formats (e.g., "facebook_post", "tiktok_script").`;

    const userPrompt = `${systemPrompt}\n\nUser Request Topic: "${topic}"\n\nGenerate JSON now.`;

    try {
        const resultText = await callAI(userPrompt);
        
        // Parse Result
        let successData;
        try {
            successData = JSON.parse(cleanJsonString(resultText));
        } catch (e) {
            // Fallback if not JSON
            successData = { "content": resultText };
        }

        renderGeneratedContent(successData);

    } catch (error) {
        showErrorInOutput(error.message);
    } finally {
        setLoading(false, 'generate');
    }
}

function renderGeneratedContent(data) {
    ui.outputContainer.innerHTML = '';
    ui.outputSection.classList.remove('hidden');

    for (const key in data) {
        const content = typeof data[key] === 'object' ? JSON.stringify(data[key], null, 2) : data[key];
        const card = document.createElement('div');
        card.className = 'card p-4 rounded-lg border-0 mb-4 bg-slate-800';
        card.innerHTML = `
            <h3 class="font-bold text-lg text-blue-400 capitalize mb-2">${key.replace(/_/g, ' ')}</h3>
            <div class="text-gray-300 whitespace-pre-wrap">${content}</div>
            <button class="mt-3 text-xs bg-slate-700 px-3 py-1 rounded text-white copy-btn">Copy</button>
        `;
        ui.outputContainer.appendChild(card);
    }
    
    // Attach copy listeners
    ui.outputContainer.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            navigator.clipboard.writeText(e.target.previousElementSibling.innerText);
            e.target.textContent = "Copied!";
            setTimeout(() => e.target.textContent = "Copy", 1500);
        });
    });
}

// --- LIGHTING ASSISTANT LOGIC ---
async function analyzeLighting(presetName, goal) {
    setLoading(true, 'analyze');
    TabState.lighting.chatHistory = []; // Reset Chat

    const systemPrompt = `You are 'Lumi', an expert Lighting Assistant. Provide a detailed lighting setup plan in Burmese. Return Valid JSON ONLY.`;
    
    const jsonStructure = {
        "lighting_style_identification": "Name of Style",
        "creative_rationale": "Why this works",
        "final_setup_diagram": {
            "diagram_svg": "SVG Code for top-down view"
        },
        "step_by_step_improvement_plan": [
            { "action": "Place Key Light", "instruction": "45 degrees to subject..." }
        ]
    };

    let requestText = `Generate a lighting setup for goal: "${goal || presetName}".`;
    const fullPrompt = `${systemPrompt}\n\nJSON Structure: ${JSON.stringify(jsonStructure)}\n\nRequest: ${requestText}`;

    try {
        const resultText = await callAI(fullPrompt);
        const data = JSON.parse(cleanJsonString(resultText));
        
        TabState.lighting.analysis = data; // Save state
        renderLightingAnalysis(data);

    } catch (error) {
        showErrorInOutput(error.message, 'lighting');
    } finally {
        setLoading(false, 'analyze');
    }
}

async function handleLightingChat() {
    const input = ui.lightingChatInput.value.trim();
    if(!input) return;
    
    // UI update
    const historyDiv = ui.lightingChatHistory;
    historyDiv.innerHTML += `<div class="text-right mb-2"><span class="bg-blue-600 text-white p-2 rounded inline-block">${input}</span></div>`;
    ui.lightingChatInput.value = '';

    const systemPrompt = `You are Lumi. Answer the user's question about the lighting setup in Burmese. Keep it short and helpful.`;
    const context = TabState.lighting.analysis ? `Current Setup: ${TabState.lighting.analysis.lighting_style_identification}` : "";
    const prompt = `${systemPrompt}\n${context}\nUser Question: "${input}"`;

    try {
        const response = await callAI(prompt);
        historyDiv.innerHTML += `<div class="text-left mb-2"><span class="bg-slate-700 text-gray-200 p-2 rounded inline-block">${response}</span></div>`;
        historyDiv.scrollTop = historyDiv.scrollHeight;
    } catch (e) {
        historyDiv.innerHTML += `<div class="text-left text-red-400">Error: ${e.message}</div>`;
    }
}

// --- PLANNER LOGIC ---
async function generateWeeklyPlan() {
    const goal = ui.plannerGoal.value;
    const posts = ui.plannerPosts.value;
    setLoading(true, 'planner');

    const prompt = `Generate a ${posts}-post weekly social media plan for a photo studio. Goal: ${goal}. Language: Burmese. Output JSON with "weekly_strategy_title" and "daily_plan" array (day, content_type, idea).`;

    try {
        const res = await callAI(prompt);
        const data = JSON.parse(cleanJsonString(res));
        renderWeeklyPlan(data);
    } catch (e) {
        showErrorInOutput(e.message, 'planner');
    } finally {
        setLoading(false, 'planner');
    }
}

// --- PROJECT DIRECTOR LOGIC ---
async function generateProjectPlan() {
    const name = ui.projectNameInput.value;
    const brief = ui.creativeBriefInput.value;
    if(!name || !brief) return showNotification("Please fill inputs", "error");

    const btn = ui.generatePlanBtn;
    const loader = document.querySelector('#generate-plan-loader');
    btn.disabled = true;
    loader.classList.remove('hidden');

    const prompt = `Act as Studio Director. Create a project plan for "${name}". Brief: "${brief}".
    Output JSON with: projectName, overallConcept, moodboard (description, keywords), lightingSetups (array of title, description), posingIdeas (array), socialMediaPost (content).
    Language: Burmese.`;

    try {
        const res = await callAI(prompt);
        const data = JSON.parse(cleanJsonString(res));
        currentProjectData = data; // Save for later saving
        renderProjectDashboard(data);
    } catch (e) {
        ui.projectDashboardContainer.innerHTML = `<div class="text-red-400">Error: ${e.message}</div>`;
    } finally {
        btn.disabled = false;
        loader.classList.add('hidden');
    }
}

// --- RENDER FUNCTIONS (Simplified) ---
function renderLightingAnalysis(data) {
    const container = ui.lightingOutputContainer;
    ui.lightingOutputSection.classList.remove('hidden');
    
    const svg = data.final_setup_diagram?.diagram_svg || '<p>No Diagram</p>';
    const steps = data.step_by_step_improvement_plan?.map(s => `<li>${s.action}: ${s.instruction}</li>`).join('') || '';

    container.innerHTML = `
        <div class="card p-4 bg-slate-800 rounded-lg mb-4">
            <h3 class="text-xl font-bold text-yellow-400">${data.lighting_style_identification}</h3>
            <p class="text-gray-400">${data.creative_rationale}</p>
            <div class="mt-4 bg-slate-900 p-2 rounded text-center">${svg}</div>
            <ul class="mt-4 list-disc list-inside text-gray-300">${steps}</ul>
            <button id="save-setup-btn" class="mt-4 bg-green-600 text-white px-4 py-2 rounded">Save to Stylebook</button>
        </div>
    `;
    
    document.getElementById('save-setup-btn').addEventListener('click', () => openSaveModal());
}

function renderWeeklyPlan(data) {
    const container = ui.plannerOutputContainer;
    ui.plannerOutputSection.classList.remove('hidden');
    container.innerHTML = `<h3 class="text-xl font-bold mb-4 text-blue-400">${data.weekly_strategy_title}</h3>`;
    
    data.daily_plan?.forEach(day => {
        container.innerHTML += `
            <div class="card p-3 mb-2 bg-slate-800 rounded border border-slate-700 flex justify-between items-center">
                <div>
                    <span class="font-bold text-white">${day.day}</span>
                    <span class="text-sm text-yellow-500 ml-2">${day.content_type}</span>
                    <p class="text-gray-400 text-sm">${day.idea}</p>
                </div>
                <button class="bg-blue-600 text-white px-3 py-1 rounded text-xs use-idea-btn" data-idea="${day.idea}">Use</button>
            </div>
        `;
    });

    container.querySelectorAll('.use-idea-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            ui.topic.value = e.target.dataset.idea;
            document.querySelector('button[data-tab="studio"]').click();
        });
    });
}

function renderProjectDashboard(data) {
    ui.directorOutputSection.classList.remove('hidden');
    const container = ui.projectDashboardContainer;
    container.innerHTML = '';

    const createCard = (title, content, btnAction) => {
        return `
            <div class="card p-4 bg-slate-800 rounded-lg border border-slate-700 mb-4">
                <h4 class="font-bold text-lg text-blue-300 mb-2">${title}</h4>
                <div class="text-gray-300 text-sm mb-3">${content}</div>
                ${btnAction ? `<button class="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs director-action-btn" ${btnAction}>Create</button>` : ''}
            </div>
        `;
    };

    container.innerHTML += createCard("Concept", data.overallConcept);
    
    data.lightingSetups?.forEach(setup => {
        container.innerHTML += createCard(`Lighting: ${setup.title}`, setup.description, `data-assistant-type="lighting" data-input-prompt="${setup.title}"`);
    });

    data.posingIdeas?.poses?.forEach(pose => {
        container.innerHTML += createCard(`Pose: ${pose.title}`, pose.description, `data-assistant-type="posing" data-input-prompt="${pose.title}"`);
    });

    // Save Button
    const saveDiv = document.createElement('div');
    saveDiv.innerHTML = `<button id="save-current-project-btn" class="w-full bg-green-600 text-white py-2 rounded font-bold">Save Project</button>`;
    container.appendChild(saveDiv);
    document.getElementById('save-current-project-btn').addEventListener('click', () => openSaveProjectModal());
}

// --- UTILS & HELPERS ---
function setLoading(loading, type) {
    const btn = type === 'generate' ? ui.generateBtn : 
                type === 'analyze' ? ui.analyzeLightingBtn : 
                type === 'planner' ? ui.generatePlannerBtn : null;
    if(!btn) return;
    btn.disabled = loading;
    btn.querySelector('span').textContent = loading ? 'Processing...' : (type === 'analyze' ? 'Analyze' : 'Generate');
}

function showErrorInOutput(msg, type='generate') {
    const container = type === 'lighting' ? ui.lightingOutputContainer : 
                      type === 'planner' ? ui.plannerOutputContainer : ui.outputContainer;
    const section = type === 'lighting' ? ui.lightingOutputSection : 
                    type === 'planner' ? ui.plannerOutputSection : ui.outputSection;
    
    if(container) container.innerHTML = `<div class="text-red-400 p-4 border border-red-800 rounded bg-red-900/20">${msg}</div>`;
    if(section) section.classList.remove('hidden');
}

function showNotification(msg, type) {
    const notif = ui.notification;
    if(!notif) return;
    ui.notificationMessage.textContent = msg;
    notif.className = `fixed top-6 right-6 z-50 p-4 rounded shadow-lg text-white transform transition-transform duration-300 ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`;
    notif.classList.remove('translate-x-full');
    setTimeout(() => notif.classList.add('translate-x-full'), 3000);
}

// Image Handling (UI Only - No Backend Support)
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            ui.imagePreview.src = e.target.result;
            ui.imagePreviewContainer.classList.remove('hidden');
            ui.imagePrompt.classList.add('hidden');
            // Store base64 just in case, though backend might ignore
            uploadedImageBase64 = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }
}

function removeImage() {
    ui.imageUploadInput.value = '';
    uploadedImageBase64 = null;
    ui.imagePreviewContainer.classList.add('hidden');
    ui.imagePrompt.classList.remove('hidden');
}

async function getPostIdeas() {
    setLoading(true, 'idea'); // Using idea loader
    const topic = ui.topic.value || "Photography";
    try {
        const res = await callAI(`Give me 5 creative post ideas for "${topic}" in Burmese.`);
        const container = document.getElementById('idea-suggestion-container');
        container.innerHTML = `<div class="p-3 bg-slate-700 rounded text-gray-200 whitespace-pre-wrap">${res}</div>`;
        container.classList.remove('hidden');
    } catch(e) {
        console.error(e);
    } finally {
        setLoading(false, 'idea');
    }
}

// Stub functions for others
async function getPoses() {
    const goal = ui.posingGoal.value;
    const cat = ui.posingCategory.value;
    const prompt = `Suggest 3 poses for ${cat}. Goal: ${goal}. Burmese JSON.`;
    try {
        const res = await callAI(prompt);
        const data = JSON.parse(cleanJsonString(res));
        // Simple render
        ui.posingOutputSection.classList.remove('hidden');
        ui.posingOutputContainer.innerHTML = `<pre class="text-gray-300 whitespace-pre-wrap">${JSON.stringify(data, null, 2)}</pre>`;
    } catch(e) { showErrorInOutput(e.message, 'posing'); }
}

async function getEditingSteps() {
    const style = ui.editingStyleInput.value;
    const prompt = `Lightroom steps for style: "${style}". Burmese JSON.`;
    try {
        const res = await callAI(prompt);
        // Simple render
        ui.editingOutputSection.classList.remove('hidden');
        ui.editingOutputContainer.innerHTML = `<pre class="text-gray-300 whitespace-pre-wrap">${res}</pre>`;
    } catch(e) { console.error(e); }
}

async function handleChromaChat() {
    const input = ui.editingChatInput.value;
    if(!input) return;
    ui.editingChatInput.value = '';
    const history = ui.editingChatHistory;
    history.innerHTML += `<div class="text-right text-blue-300 mb-1">${input}</div>`;
    
    try {
        const res = await callAI(`User asked about editing: "${input}". Reply in Burmese.`);
        history.innerHTML += `<div class="text-left text-gray-300 mb-1">${res}</div>`;
    } catch(e) {
        history.innerHTML += `<div class="text-red-400">Error</div>`;
    }
}

// UI Helpers
function handleTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab;
    localStorage.setItem('activeTab', tab);
    
    document.querySelectorAll('.main-content').forEach(el => el.classList.add('hidden'));
    document.querySelector(`.main-content[data-content="${tab}"]`).classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn-desktop').forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    // Close mobile menu
    document.getElementById('sidebar-section').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
    
    // Lazy load Stylebooks
    if(tab === 'lighting' && userId) loadLightingStylebook();
    if(tab === 'projects' && userId) loadProjectStylebook();
}

function setupMobileMenu() {
    const menuBtn = document.getElementById('hamburger-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('sidebar-section');
    const overlay = document.getElementById('sidebar-overlay');

    const toggle = () => {
        sidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    };

    if(menuBtn) menuBtn.addEventListener('click', toggle);
    if(closeBtn) closeBtn.addEventListener('click', toggle);
    if(overlay) overlay.addEventListener('click', toggle);
}

function populateCreativeAssistantTools() {
    const tools = [
        { id: 'hook', label: 'Hook' }, { id: 'hashtags', label: 'Hashtags' }, 
        { id: 'cta', label: 'CTA' }, { id: 'emoji', label: 'Emoji' }
    ];
    const container = document.getElementById('creative-assistant-tools');
    if(container) {
        container.innerHTML = tools.map(t => `<div><input type="checkbox" id="assistant-${t.id}" value="${t.id}" name="assistant-tools" class="mr-2"><label>${t.label}</label></div>`).join('');
    }
}

function populateContentFormats() {
    const formats = ['Facebook Post', 'TikTok Caption', 'Ad Copy'];
    const container = document.getElementById('content-format-container');
    if(container) {
        container.innerHTML = formats.map(f => `<div><input type="checkbox" name="content-format" value="${f}" class="mr-2"><label>${f}</label></div>`).join('');
    }
}

function renderPresetGalleries() {
    // Simple presets
    const lContainer = document.getElementById('lighting-preset-gallery');
    if(lContainer) lContainer.innerHTML = '<button class="bg-slate-700 p-2 rounded lighting-preset-btn">Rembrandt</button><button class="bg-slate-700 p-2 rounded lighting-preset-btn">Butterfly</button>';
}

// Brand Voice / Data Persistence (Kept from original)
async function saveBrandVoice() {
    if(!userId) return;
    const data = {
        description: ui.brandDescription.value,
        samples: ui.brandSamples.value,
        rules: ui.brandRules.value
    };
    await setDoc(doc(db, `artifacts/${appId}/users/${userId}/brandVoice/data`), data);
    ui.brandVoiceModal.classList.add('hidden');
    showNotification("Brand Voice Saved", "success");
}

async function loadBrandVoice() {
    if(!userId) return;
    const snap = await getDoc(doc(db, `artifacts/${appId}/users/${userId}/brandVoice/data`));
    if(snap.exists()) {
        const data = snap.data();
        ui.brandDescription.value = data.description || '';
        ui.brandSamples.value = data.samples || '';
        ui.brandRules.value = data.rules || '';
    }
}

// Stylebook Loading (Simplified)
function loadLightingStylebook() {
    // Use Firestore onSnapshot to load into ui.stylebookContainer
    // Implementation kept minimal for brevity, reusing existing patterns
    const q = query(collection(db, `artifacts/${appId}/users/${userId}/lightingStylebook`), orderBy('createdAt', 'desc'), limit(10));
    onSnapshot(q, (snap) => {
        ui.stylebookContainer.innerHTML = '';
        if(snap.empty) ui.stylebookPlaceholder.classList.remove('hidden');
        else {
            ui.stylebookPlaceholder.classList.add('hidden');
            snap.forEach(d => {
                const data = d.data();
                const div = document.createElement('div');
                div.className = 'bg-slate-700 p-3 rounded mb-2';
                div.innerHTML = `<p class="font-bold">${data.name}</p>`;
                ui.stylebookContainer.appendChild(div);
            });
        }
    });
}

function loadProjectStylebook() {
    const q = query(collection(db, `artifacts/${appId}/users/${userId}/projectStylebook`), orderBy('createdAt', 'desc'), limit(10));
    onSnapshot(q, (snap) => {
        const container = document.getElementById('project-stylebook-container');
        if(!container) return;
        container.innerHTML = '';
        snap.forEach(d => {
            const data = d.data();
            container.innerHTML += `<div class="bg-slate-700 p-3 rounded mb-2"><p>${data.name}</p></div>`;
        });
    });
}

// Modal handling
function openSaveModal() { ui.saveLightingModal.classList.remove('hidden'); }
function openSaveProjectModal() { ui.saveProjectModal.classList.remove('hidden'); }
async function handleSaveOrUpdateSetup() {
    const name = ui.setupNameInput.value;
    if(!name) return;
    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/lightingStylebook`), {
        name, createdAt: new Date(), analysisData: TabState.lighting.analysis
    });
    ui.saveLightingModal.classList.add('hidden');
    showNotification("Saved!", "success");
}
async function handleSaveOrUpdateProject() {
    const name = document.getElementById('project-modal-name').value;
    if(!name) return;
    await addDoc(collection(db, `artifacts/${appId}/users/${userId}/projectStylebook`), {
        name, createdAt: new Date(), fullProjectData: currentProjectData
    });
    ui.saveProjectModal.classList.add('hidden');
    showNotification("Project Saved!", "success");
}

function handleDirectorActionClick(e) {
    if(e.target.classList.contains('director-action-btn')) {
        const type = e.target.dataset.assistantType;
        const prompt = e.target.dataset.inputPrompt;
        
        // Auto-navigate and fill
        if(type === 'lighting') {
            document.querySelector('button[data-tab="lighting"]').click();
            ui.lightingGoalInput.value = prompt;
        } else if(type === 'posing') {
            document.querySelector('button[data-tab="posing"]').click();
            ui.posingGoal.value = prompt;
        } else if(type === 'studio') {
            document.querySelector('button[data-tab="studio"]').click();
            ui.topic.value = prompt;
        }
    }
}
