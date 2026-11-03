
const $ = id => document.getElementById(id);

const esc = s =>
    String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

let members = [];

async function api(url, method = "GET", body) {
    const r = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
    });

    const d = await r.json().catch(() => ({}));

    if (r.status === 401 && url !== "/api/login") {
        showLogin();
        throw new Error(d.error);
    }

    if (!r.ok) {
        throw new Error(d.error || "Something went wrong.");
    }

    return d;
}

function toast(msg, err) {
    const t = $("toast");

    t.textContent = msg;
    t.className = "toast" + (err ? " err" : "");
    t.style.display = "block";

    clearTimeout(toast.id);

    toast.id = setTimeout(
        () => t.style.display = "none",
        3200
    );
}

const run = fn => async (...a) => {
    try {
        await fn(...a);
    } catch (e) {
        toast(e.message, true);
    }
};

function showLogin() {
    $("app").hidden = true;
    $("loginView").hidden = false;
}

async function showApp() {
    $("loginView").hidden = true;
    $("app").hidden = false;

    await refresh();
}

$("loginBtn").onclick = run(async () => {
    await api("/api/login", "POST", {
        password: $("pw").value
    });

    $("pw").value = "";

    await showApp();
});

$("pw").onkeydown = e => {
    if (e.key === "Enter") {
        $("loginBtn").click();
    }
};

$("logout").onclick = async () => {
    await api("/api/logout", "POST");
    showLogin();
};

document.querySelectorAll(".tabs button").forEach(b => {
    b.onclick = () => {
        document
            .querySelectorAll(".tabs button,.panel")
            .forEach(x => x.classList.remove("on"));

        b.classList.add("on");
        $(b.dataset.t).classList.add("on");
    };
});

async function refresh() {
    members = await api("/api/members");

    renderResults();
    renderMembers();
    renderPicker();

    await loadToday();
    await loadProgress();
}

/* Check-in */

function renderResults() {
    const q = $("q").value.trim().toLowerCase();

    const list = members
        .filter(m =>
            !q ||
            [m.name, m.code, m.phone].some(v =>
                (v || "").toLowerCase().includes(q)
            )
        )
        .slice(0, 8);

    $("results").innerHTML = list.length
        ? list.map(m => `
            <div class="card" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;padding:1rem">
                <div>
                    <b>${esc(m.name)}</b><br>
                    <small>${esc(m.code)} · ${esc(m.plan)}</small>
                </div>

                ${m.in_today
                ? '<span class="pill in">Checked in</span>'
                : `<button class="btn sm" data-in="${m.id}">Check in</button>`
            }
            </div>
        `).join("")
        : '<div class="empty">No members match. Add them in the Members tab.</div>';
}

$("q").oninput = renderResults;

$("results").onclick = run(async e => {
    const id = e.target.dataset.in;

    if (!id) return;

    const d = await api("/api/checkin", "POST", {
        member_id: +id
    });

    toast(d.name + " is checked in.");

    await refresh();
});

async function loadToday() {
    const rows = await api("/api/checkins/today");

    $("todayCount").textContent = rows.length;

    $("today").innerHTML = rows.length
        ? `
            <table>
                ${rows.map(r => `
                    <tr>
                        <td>${esc(r.at)}</td>
                        <td>${esc(r.name)}</td>
                        <td>${esc(r.code)}</td>
                    </tr>
                `).join("")}
            </table>
        `
        : '<div class="empty">No one has checked in yet today.</div>';
}

/* Members */

$("addMember").onclick = run(async () => {
    const d = await api("/api/members", "POST", {
        name: $("nName").value,
        phone: $("nPhone").value,
        plan: $("nPlan").value,
        goal: $("nGoal").value
    });

    ["nName", "nPhone", "nGoal"].forEach(i => {
        $(i).value = "";
    });

    toast("Added. Member code: " + d.code);

    await refresh();
});

function renderMembers() {
    $("memberTable").innerHTML = members.length
        ? `
            <table>
                <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Plan</th>
                    <th>Goal</th>
                    <th>Visits</th>
                    <th>Last visit</th>
                    <th></th>
                </tr>

                ${members.map(m => `
                    <tr>
                        <td>${esc(m.code)}</td>
                        <td>${esc(m.name)}</td>
                        <td>
                            <span class="pill">${esc(m.plan)}</span>
                        </td>
                        <td>${esc(m.goal)}</td>
                        <td>${m.visits}</td>
                        <td>${esc(m.last_visit || "Never")}</td>
                        <td>
                            <button class="btn sm ghost" data-del="${m.id}">
                                Remove
                            </button>
                        </td>
                    </tr>
                `).join("")}
            </table>
        `
        : '<div class="empty">No members yet. Add your first one above.</div>';
}

$("memberTable").onclick = run(async e => {
    const id = e.target.dataset.del;

    if (id && confirm("Remove this member and all their records?")) {
        await api("/api/members/" + id, "DELETE");

        await refresh();
    }
});

/* Progress */

function renderPicker() {
    const cur = $("pMember").value;

    $("pMember").innerHTML = members
        .map(m => `
            <option value="${m.id}">
                ${esc(m.name)} (${esc(m.code)})
            </option>
        `)
        .join("");

    if (cur) {
        $("pMember").value = cur;
    }
}

$("pMember").onchange = run(loadProgress);

$("addProg").onclick = run(async () => {
    if (!$("pMember").value) {
        throw new Error("Add a member first.");
    }

    await api(
        `/api/members/${$("pMember").value}/progress`,
        "POST",
        {
            weight: $("pW").value,
            body_fat: $("pF").value,
            note: $("pN").value
        }
    );

    ["pW", "pF", "pN"].forEach(i => {
        $(i).value = "";
    });

    toast("Progress saved.");

    await loadProgress();
});

async function loadProgress() {
    const id = $("pMember").value;

    if (!id) {
        $("chart").innerHTML =
            '<div class="empty">No members yet.</div>';

        $("progTable").innerHTML = "";

        return;
    }

    const rows = await api(`/api/members/${id}/progress`);

    const pts = rows.filter(r => r.weight != null);

    if (pts.length < 2) {
        $("chart").innerHTML =
            '<div class="empty">Log two weigh-ins to see a trend.</div>';
    } else {
        const w = pts.map(p => p.weight);
        const lo = Math.min(...w);
        const hi = Math.max(...w);
        const span = hi - lo || 1;

        const xy = pts.map((p, i) => [
            20 + i * 260 / (pts.length - 1),
            110 - (p.weight - lo) / span * 90
        ]);

        $("chart").innerHTML = `
            <svg
                viewBox="0 0 300 130"
                width="100%"
                role="img"
                aria-label="Weight trend"
            >
                <polyline
                    fill="none"
                    stroke="#3b7a4b"
                    stroke-width="3"
                    points="${xy.map(p => p.join(",")).join(" ")}"
                />

                ${xy.map(p => `
                    <circle
                        cx="${p[0]}"
                        cy="${p[1]}"
                        r="4"
                        fill="#1c4a31"
                    />
                `).join("")}
            </svg>

            <small>
                ${lo} kg to ${hi} kg across ${pts.length} entries
            </small>
        `;
    }

    $("progTable").innerHTML = rows.length
        ? `
            <table>
                <tr>
                    <th>Date</th>
                    <th>Weight</th>
                    <th>Body fat</th>
                    <th>Notes</th>
                </tr>

                ${rows.slice().reverse().map(r => `
                    <tr>
                        <td>${esc(r.day)}</td>
                        <td>${r.weight ?? ""}</td>
                        <td>${r.body_fat ?? ""}</td>
                        <td>${esc(r.note)}</td>
                    </tr>
                `).join("")}
            </table>
        `
        : '<div class="empty">No entries for this member yet.</div>';
}

/* Settings */

$("savePw").onclick = run(async () => {
    if ($("sNew").value !== $("sNew2").value) {
        throw new Error("The new passwords don't match.");
    }

    await api("/api/password", "POST", {
        current: $("sCur").value,
        new: $("sNew").value
    });

    ["sCur", "sNew", "sNew2"].forEach(i => {
        $(i).value = "";
    });

    toast("Password changed.");
});

api("/api/me")
    .then(d => d.admin ? showApp() : showLogin());
