    const STORAGE_USERS = "smartTask_users";
    const STORAGE_TASKS_PREFIX = "smartTasks_";
    const STORAGE_SESSION = "smartTask_session";

    let currentUser = null;
    let tasks = [];   
    let filterStatus = "all";
    let searchQuery = "";

    function loadTasksFromStorage() {
        if(!currentUser) return [];
        const key = STORAGE_TASKS_PREFIX + currentUser.username;
        const stored = localStorage.getItem(key);
        tasks = stored ? JSON.parse(stored) : [];
        return tasks;
    }

    function saveTasksToStorage() {
        if(!currentUser) return;
        const key = STORAGE_TASKS_PREFIX + currentUser.username;
        localStorage.setItem(key, JSON.stringify(tasks));
    }

    function getUsers() {
        const raw = localStorage.getItem(STORAGE_USERS);
        return raw ? JSON.parse(raw) : [];
    }

    function saveUsers(users) {
        localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
    }

    function loginUser(username, password) {
        const users = getUsers();
        const user = users.find(u => u.username === username && u.password === password);
        if(user) {
            currentUser = { username: user.username };
            localStorage.setItem(STORAGE_SESSION, JSON.stringify(currentUser));
            loadTasksFromStorage();
            renderDashboardUI();
            return true;
        }
        return false;
    }

    function signupUser(username, password) {
        const users = getUsers();
        if(users.find(u => u.username === username)) return false;
        users.push({ username, password });
        saveUsers(users);
        return loginUser(username, password);
    }

    function logout() {
        currentUser = null;
        localStorage.removeItem(STORAGE_SESSION);
        tasks = [];
        showAuthScreen();
    }

    function checkAutoLogin() {
        const session = localStorage.getItem(STORAGE_SESSION);
        if(session) {
            try {
                const user = JSON.parse(session);
                const users = getUsers();
                const exists = users.find(u => u.username === user.username);
                if(exists) {
                    currentUser = { username: exists.username };
                    loadTasksFromStorage();
                    renderDashboardUI();
                    return true;
                }
            } catch(e) {}
        }
        showAuthScreen();
        return false;
    }

    function filterTasks() {
        let filtered = tasks.filter(t => {
            const matchStatus = filterStatus === "all" ? true : t.status === filterStatus;
            const matchSearch = searchQuery === "" || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchStatus && matchSearch;
        });
        return filtered;
    }

    function updateStatsAndColumns() {
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === "completed").length;
        const pending = tasks.filter(t => t.status === "pending").length;
        const inProgress = tasks.filter(t => t.status === "in-progress").length;
        document.getElementById("totalTasksStat").innerText = total;
        document.getElementById("completedTasksStat").innerText = completed;
        document.getElementById("pendingTasksStat").innerText = pending;
        document.getElementById("progressTasksStat").innerText = inProgress;
        document.getElementById("pendingCountBadge").innerText = pending;
        document.getElementById("progressCountBadge").innerText = inProgress;
        document.getElementById("completedCountBadge").innerText = completed;


        const filtered = filterTasks();
        const pendingTasks = filtered.filter(t => t.status === "pending");
        const progressTasks = filtered.filter(t => t.status === "in-progress");
        const completedTasks = filtered.filter(t => t.status === "completed");
        renderTaskList("pendingList", pendingTasks, "pending");
        renderTaskList("progressList", progressTasks, "in-progress");
        renderTaskList("completedList", completedTasks, "completed");
    }

    function renderTaskList(containerId, taskArray, columnStatus) {
        const container = document.getElementById(containerId);
        if(!container) return;
        container.innerHTML = "";
        if(taskArray.length === 0) {
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "empty-tasks";
            emptyDiv.innerText = "No tasks";
            container.appendChild(emptyDiv);
        } else {
            taskArray.forEach(task => {
                const taskEl = createTaskCardElement(task);
                taskEl.setAttribute("data-id", task.id);
                taskEl.setAttribute("data-status", task.status);
                taskEl.draggable = true;
                taskEl.addEventListener("dragstart", handleDragStart);
                taskEl.addEventListener("dragend", handleDragEnd);
                container.appendChild(taskEl);
            });
        }
    }

    function createTaskCardElement(task) {
        const div = document.createElement("div");
        div.className = "task-card";
        div.setAttribute("data-id", task.id);
        div.innerHTML = `
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-desc">${task.description ? escapeHtml(task.description) : "No description"}</div>
            <div class="task-actions">
                ${task.status !== "completed" ? `<i class="fas fa-check-circle" title="Mark Complete" data-action="complete"></i>` : ''}
                <i class="fas fa-edit" title="Edit" data-action="edit"></i>
                <i class="fas fa-trash-alt" title="Delete" data-action="delete"></i>
            </div>
        `;
    
        const actions = div.querySelectorAll(".task-actions i");
        actions.forEach(icon => {
            icon.addEventListener("click", (e) => {
                e.stopPropagation();
                const action = icon.getAttribute("data-action");
                if(action === "complete") completeTask(task.id);
                if(action === "edit") openEditModal(task.id);
                if(action === "delete") deleteTaskById(task.id);
            });
        });
        return div;
    }

    let draggedItemId = null;
    function handleDragStart(e) {
        const card = e.target.closest(".task-card");
        if(!card) return;
        draggedItemId = card.getAttribute("data-id");
        e.dataTransfer.setData("text/plain", draggedItemId);
        card.classList.add("dragging");
    }
    function handleDragEnd(e) {
        const card = e.target.closest(".task-card");
        if(card) card.classList.remove("dragging");
        draggedItemId = null;
        document.querySelectorAll(".task-list").forEach(list => list.classList.remove("drag-over"));
    }

    function setupDragDrop() {
        const lists = document.querySelectorAll(".task-list");
        lists.forEach(list => {
            list.addEventListener("dragover", (e) => {
                e.preventDefault();
                list.classList.add("drag-over");
            });
            list.addEventListener("dragleave", () => list.classList.remove("drag-over"));
            list.addEventListener("drop", (e) => {
                e.preventDefault();
                list.classList.remove("drag-over");
                const targetStatus = list.getAttribute("data-status");
                if(draggedItemId && targetStatus) {
                    const task = tasks.find(t => t.id == draggedItemId);
                    if(task && task.status !== targetStatus) {
                        task.status = targetStatus;
                        saveTasksToStorage();
                        updateStatsAndColumns();
                    }
                }
                draggedItemId = null;
            });
        });
    }

    function addTask(title, description, status) {
        if(!title.trim()) return;
        const newTask = {
            id: Date.now(),
            title: title.trim(),
            description: description.trim(),
            status: status,
            createdAt: new Date().toISOString()
        };
        tasks.push(newTask);
        saveTasksToStorage();
        updateStatsAndColumns();
    }

    function updateTask(taskId, title, description, status) {
        const idx = tasks.findIndex(t => t.id == taskId);
        if(idx !== -1) {
            tasks[idx].title = title.trim();
            tasks[idx].description = description.trim();
            tasks[idx].status = status;
            saveTasksToStorage();
            updateStatsAndColumns();
        }
    }

    function deleteTaskById(id) {
        tasks = tasks.filter(t => t.id != id);
        saveTasksToStorage();
        updateStatsAndColumns();
    }

    function completeTask(id) {
        const task = tasks.find(t => t.id == id);
        if(task && task.status !== "completed") {
            task.status = "completed";
            saveTasksToStorage();
            updateStatsAndColumns();
        }
    }

    let currentEditId = null;
    function openAddModal() {
        currentEditId = null;
        document.getElementById("modalTitle").innerText = "Add New Task";
        document.getElementById("taskTitleInput").value = "";
        document.getElementById("taskDescInput").value = "";
        document.getElementById("taskStatusInput").value = "pending";
        document.getElementById("editTaskId").value = "";
        document.getElementById("taskModal").style.display = "flex";
    }
    function openEditModal(id) {
        const task = tasks.find(t => t.id == id);
        if(!task) return;
        currentEditId = id;
        document.getElementById("modalTitle").innerText = "Edit Task";
        document.getElementById("taskTitleInput").value = task.title;
        document.getElementById("taskDescInput").value = task.description || "";
        document.getElementById("taskStatusInput").value = task.status;
        document.getElementById("editTaskId").value = id;
        document.getElementById("taskModal").style.display = "flex";
    }
    function closeModal() {
        document.getElementById("taskModal").style.display = "none";
    }
    function saveModalTask() {
        const title = document.getElementById("taskTitleInput").value;
        const desc = document.getElementById("taskDescInput").value;
        const status = document.getElementById("taskStatusInput").value;
        const editId = document.getElementById("editTaskId").value;
        if(!title.trim()) return;
        if(editId) {
            updateTask(parseInt(editId), title, desc, status);
        } else {
            addTask(title, desc, status);
        }
        closeModal();
    }

    function renderDashboardUI() {
        document.getElementById("authContainer").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        document.getElementById("displayUsername").innerHTML = `Hello, ${currentUser.username} 👋`;
        updateStatsAndColumns();
        setupDragDrop();
        attachToolbarEvents();
        // reattach drag after re-render
        setTimeout(() => setupDragDrop(), 20);
    }

    function attachToolbarEvents() {
        const searchInput = document.getElementById("searchInput");
        const filterSelect = document.getElementById("filterStatusSelect");
        searchInput.oninput = (e) => { searchQuery = e.target.value; updateStatsAndColumns(); };
        filterSelect.onchange = (e) => { filterStatus = e.target.value; updateStatsAndColumns(); };
    }

    function showAuthScreen() {
        document.getElementById("authContainer").style.display = "flex";
        document.getElementById("dashboard").style.display = "none";
        document.getElementById("authError").innerText = "";
        setupAuthEvents();
    }

    let authMode = "login";
    function setupAuthEvents() {
        const toggle = document.getElementById("toggleAuthMode");
        const submitBtn = document.getElementById("authSubmitBtn");
        const authTitle = document.getElementById("authTitle");
        const updateMode = () => {
            if(authMode === "login") {
                authTitle.innerText = "Login";
                submitBtn.innerText = "Login";
                toggle.innerText = "Don't have an account? Sign up";
            } else {
                authTitle.innerText = "Sign Up";
                submitBtn.innerText = "Sign Up";
                toggle.innerText = "Already have an account? Login";
            }
        };
        updateMode();
        toggle.onclick = () => {
            authMode = authMode === "login" ? "signup" : "login";
            updateMode();
            document.getElementById("authError").innerText = "";
        };
        submitBtn.onclick = () => {
            const user = document.getElementById("authUsername").value.trim();
            const pass = document.getElementById("authPassword").value.trim();
            if(!user || !pass) { document.getElementById("authError").innerText = "Username and password required"; return; }
            let success = false;
            if(authMode === "login") success = loginUser(user, pass);
            else success = signupUser(user, pass);
            if(!success) document.getElementById("authError").innerText = authMode === "login" ? "Invalid credentials" : "Username already exists";
            else { document.getElementById("authError").innerText = ""; }
        };
    }


    function initTheme() {
        const theme = localStorage.getItem("theme");
        if(theme === "dark") document.body.classList.add("dark");
        document.getElementById("themeToggleBtn").addEventListener("click", () => {
            document.body.classList.toggle("dark");
            localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
        });
    }

    function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, function(m){if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }


    document.getElementById("openAddTaskModal")?.addEventListener("click", openAddModal);
    document.getElementById("closeModalBtn")?.addEventListener("click", closeModal);
    document.getElementById("saveTaskBtn")?.addEventListener("click", saveModalTask);
    document.getElementById("logoutBtn")?.addEventListener("click", logout);
    window.addEventListener("click", (e) => { if(e.target === document.getElementById("taskModal")) closeModal(); });

    initTheme();
    checkAutoLogin();
