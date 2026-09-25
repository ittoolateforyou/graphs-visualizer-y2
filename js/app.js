const state = {
    vertices: [],
    edges: [],
    mode: 'vertex',
    nextEdgeId: 0,
    selectedVertex: null,
    hoveredVertex: null,
    draggingVertex: null,
    didDrag: false,
    analysis: null,
    animationSteps: [],
    animationIndex: 0,
    animationTimer: null,
    animationSpeed: 900
};

const dom = {
    canvas: document.getElementById('graphCanvas'),
    modeVertex: document.getElementById('modeVertex'),
    modeEdge: document.getElementById('modeEdge'),
    edgeWeight: document.getElementById('edgeWeightInput'),
    source: document.getElementById('sourceSelect'),
    target: document.getElementById('targetSelect'),
    result: document.getElementById('resultContent'),
    stats: document.getElementById('canvasStats'),
    matrix: document.getElementById('matrixContent'),
    matrixContainer: document.getElementById('matrixContainer'),
    animationBar: document.getElementById('animControlBar'),
    animationDescription: document.getElementById('animStepDesc'),
    animationPausePlay: document.getElementById('animPausePlay'),
    step: document.getElementById('btnStep'),
    play: document.getElementById('btnPlay'),
    randomCount: document.getElementById('vertexCountRange'),
    randomCountValue: document.getElementById('vertexCountVal'),
    randomWeightMode: document.getElementById('weightMode'),
    randomExtraBranches: document.getElementById('randomExtraBranches'),
    randomDensity: document.getElementById('randomDensity')
};
const context = dom.canvas.getContext('2d');

function vertexName(id) {
    return state.vertices.find(vertex => vertex.id === id)?.name ?? String(id);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function edgeKey(u, v) {
    return `${Math.min(u, v)}-${Math.max(u, v)}`;
}

function edgeBetween(u, v) {
    return state.edges.find(edge => (edge.u === u && edge.v === v) || (edge.u === v && edge.v === u));
}

function graphAdjacency() {
    const adjacency = Object.fromEntries(state.vertices.map(vertex => [vertex.id, []]));
    state.edges.forEach(edge => {
        if (adjacency[edge.u] && adjacency[edge.v]) {
            adjacency[edge.u].push({ id: edge.v, edgeId: edge.id, weight: edge.weight });
            adjacency[edge.v].push({ id: edge.u, edgeId: edge.id, weight: edge.weight });
        }
    });
    return adjacency;
}

function setGraph(vertices, edges) {
    state.vertices = vertices.map(vertex => ({ ...vertex }));
    state.edges = edges.map((edge, index) => ({ id: edge.id ?? index, u: edge.u, v: edge.v, weight: edge.weight ?? 1 }));
    state.nextEdgeId = state.edges.reduce((max, edge) => Math.max(max, edge.id), -1) + 1;
    state.selectedVertex = null;
    resetAnalysis();
    updateSelectors();
    updateStats();
    drawGraph();
}

function resetAnalysis() {
    stopAnimation();
    state.analysis = null;
    state.animationSteps = [];
    state.animationIndex = 0;
    dom.animationBar.classList.add('hidden');
    dom.animationBar.classList.remove('flex');
    dom.step.disabled = true;
    dom.play.disabled = true;
    dom.result.innerHTML = '<p class="italic text-slate-400">Đồ thị đã thay đổi. Hãy bấm Phân tích.</p>';
}

function updateStats() {
    dom.stats.textContent = `${state.vertices.length} đỉnh | ${state.edges.length} cạnh`;
    updateMatrix();
}

function updateSelectors() {
    const previousSource = dom.source.value;
    const previousTarget = dom.target.value;
    const options = state.vertices.map(vertex => `<option value="${vertex.id}">${escapeHtml(vertex.name)}</option>`).join('');
    dom.source.innerHTML = options;
    dom.target.innerHTML = options;
    if (state.vertices.some(vertex => String(vertex.id) === previousSource)) dom.source.value = previousSource;
    if (state.vertices.some(vertex => String(vertex.id) === previousTarget)) dom.target.value = previousTarget;
    if (state.vertices.length > 1 && dom.source.value === dom.target.value) dom.target.value = String(state.vertices[1].id);
}

function updateMatrix() {
    if (state.vertices.length === 0) {
        dom.matrix.textContent = 'Chưa có đồ thị.';
        return;
    }
    const adjacency = graphAdjacency();
    const header = `    ${state.vertices.map(vertex => vertex.name.padStart(5)).join('')}`;
    const rows = state.vertices.map(vertex => {
        const values = state.vertices.map(other => adjacency[vertex.id].find(item => item.id === other.id)?.weight ?? 0);
        return `${vertex.name.padEnd(3)}| ${values.map(value => String(value).padStart(5)).join('')}`;
    });
    dom.matrix.textContent = [header, ...rows].join('\n');
}

function resizeCanvas() {
    const rect = dom.canvas.parentElement.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    dom.canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    dom.canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    dom.canvas.style.width = `${rect.width}px`;
    dom.canvas.style.height = `${rect.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawGraph();
}

function canvasPoint(event) {
    const rect = dom.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function findVertexAt(point) {
    return state.vertices.find(vertex => Math.hypot(vertex.x - point.x, vertex.y - point.y) <= 23) ?? null;
}

function drawGraph(highlightedVertices = [], highlightedEdges = []) {
    const ratio = window.devicePixelRatio || 1;
    const width = dom.canvas.width / ratio;
    const height = dom.canvas.height / ratio;
    context.clearRect(0, 0, width, height);
    const dark = document.documentElement.classList.contains('dark');

    state.edges.forEach(edge => {
        const start = state.vertices.find(vertex => vertex.id === edge.u);
        const end = state.vertices.find(vertex => vertex.id === edge.v);
        if (!start || !end) return;
        const isHighlighted = highlightedEdges.some(item => item.edgeId === edge.id || (item.u === edge.u && item.v === edge.v) || (item.u === edge.v && item.v === edge.u));
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.strokeStyle = isHighlighted ? '#10b981' : (dark ? '#475569' : '#cbd5e1');
        context.lineWidth = isHighlighted ? 4 : 2;
        context.stroke();
        const labelX = (start.x + end.x) / 2;
        const labelY = (start.y + end.y) / 2;
        context.fillStyle = dark ? '#e2e8f0' : '#334155';
        context.font = '500 11px DM Mono, monospace';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(String(edge.weight), labelX, labelY - 8);
    });

    state.vertices.forEach(vertex => {
        const selected = state.selectedVertex?.id === vertex.id;
        const hovered = state.hoveredVertex?.id === vertex.id;
        const highlighted = highlightedVertices.includes(vertex.id);
        context.beginPath();
        context.arc(vertex.x, vertex.y, 20, 0, 2 * Math.PI);
        context.fillStyle = highlighted ? '#10b981' : selected ? '#f59e0b' : dark ? '#1e293b' : '#ffffff';
        context.fill();
        context.lineWidth = 3;
        context.strokeStyle = highlighted ? '#059669' : selected ? '#d97706' : hovered ? '#6366f1' : '#64748b';
        context.stroke();
        context.fillStyle = highlighted || selected ? '#ffffff' : dark ? '#f8fafc' : '#172033';
        context.font = '700 12px Space Grotesk, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(vertex.name, vertex.x, vertex.y);
    });
}

function randomPosition(index, count, width, height) {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(70, Math.min(centerX, centerY) - 90);
    const angle = index * 2 * Math.PI / count - Math.PI / 2;
    return { x: centerX + radius * Math.cos(angle) + (Math.random() - .5) * 24, y: centerY + radius * Math.sin(angle) + (Math.random() - .5) * 24 };
}

function randomWeight(mode) {
    if (mode === 'negative') return Math.floor(Math.random() * 15) - 5;
    return Math.floor(Math.random() * 9) + 1;
}

function selectedRandomAlgorithms() {
    return [...document.querySelectorAll('#randomAlgorithmOptions input:checked')].map(input => input.value);
}

function selectedAnalysisAlgorithms() {
    return new Set([...document.querySelectorAll('#analysisOptions input:checked')].map(input => input.value));
}

function addUniqueRandomEdge(edges, u, v, weightMode) {
    if (u === v || edges.some(edge => edgeKey(edge.u, edge.v) === edgeKey(u, v))) return false;
    edges.push({ u, v, weight: randomWeight(weightMode) });
    return true;
}

function createRandomBaseEdges(count, weightMode) {
    const edges = [];
    const shape = Math.floor(Math.random() * 4);
    if (shape === 0 || count < 4) {
        for (let index = 0; index < count; index += 1) addUniqueRandomEdge(edges, index, (index + 1) % count, weightMode);
        return edges;
    }
    if (shape === 1) {
        for (let index = 1; index < count; index += 1) addUniqueRandomEdge(edges, index, Math.floor(Math.random() * index), weightMode);
        return edges;
    }
    if (shape === 2) {
        const hub = Math.floor(Math.random() * count);
        for (let index = 0; index < count; index += 1) if (index !== hub) addUniqueRandomEdge(edges, hub, index, weightMode);
        return edges;
    }
    for (let index = 0; index < count - 1; index += 1) addUniqueRandomEdge(edges, index, index + 1, weightMode);
    for (let index = 0; index < Math.floor(count / 2); index += 1) addUniqueRandomEdge(edges, index, count - 1 - index, weightMode);
    return edges;
}

function addRandomBranches(edges, count, weightMode, density, preserveEuler) {
    const attempts = density === 'dense' ? count * 3 : density === 'light' ? count : count * 2;
    const addedEdges = [];
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        const u = Math.floor(Math.random() * count);
        const v = Math.floor(Math.random() * count);
        if (addUniqueRandomEdge(edges, u, v, weightMode)) addedEdges.push(edges[edges.length - 1]);
    }
    if (preserveEuler) {
        const degrees = Array(count).fill(0);
        edges.forEach(edge => { degrees[edge.u] += 1; degrees[edge.v] += 1; });
        if (degrees.some(degree => degree % 2 !== 0)) {
            addedEdges.forEach(edge => {
                const index = edges.indexOf(edge);
                if (index >= 0) edges.splice(index, 1);
            });
        }
    }
}

function generationConflict(algorithms, weightMode, count) {
    const errors = [];
    if (algorithms.includes('dijkstra') && weightMode === 'negative') errors.push('Dijkstra không thể chạy cùng chế độ trọng số âm. Hãy bỏ Dijkstra hoặc chọn trọng số không âm.');
    if (algorithms.includes('hamilton') && count < 3) errors.push('Hamilton cần ít nhất 3 đỉnh.');
    if (algorithms.includes('euler') && count < 2) errors.push('Euler cần ít nhất 2 đỉnh.');
    return errors;
}

function generateRandomGraph() {
    const count = Number(dom.randomCount.value);
    const weightMode = dom.randomWeightMode.value;
    const algorithms = selectedRandomAlgorithms();
    const errors = generationConflict(algorithms, weightMode, count);
    if (errors.length > 0) {
        resetAnalysis();
        showError(errors.join('<br>'));
        return;
    }

    const rect = dom.canvas.parentElement.getBoundingClientRect();
    const vertices = Array.from({ length: count }, (_, index) => ({ id: index, name: String.fromCharCode(65 + index), ...randomPosition(index, count, rect.width, rect.height) }));
    const mustPreserveCycle = algorithms.includes('euler') || algorithms.includes('hamilton');
    const edges = mustPreserveCycle
        ? Array.from({ length: count }, (_, index) => ({ u: index, v: (index + 1) % count, weight: randomWeight(weightMode) }))
        : createRandomBaseEdges(count, weightMode);
    if (dom.randomExtraBranches.checked) addRandomBranches(edges, count, weightMode, dom.randomDensity.value, algorithms.includes('euler'));
    setGraph(vertices, edges);
    analyzeGraph();
}

function createPreset(type) {
    const rect = dom.canvas.parentElement.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const circleVertices = (count, radius = 120, offset = -Math.PI / 2) => Array.from({ length: count }, (_, id) => ({
        id,
        name: String.fromCharCode(65 + id),
        x: centerX + radius * Math.cos(offset + id * 2 * Math.PI / count),
        y: centerY + radius * Math.sin(offset + id * 2 * Math.PI / count)
    }));
    const weighted = pairs => pairs.map(([u, v], index) => ({ u, v, weight: (index % 5) + 1 }));
    if (type === 'both') {
        const coordinates = [{ x: centerX - 90, y: centerY - 70 }, { x: centerX + 90, y: centerY - 70 }, { x: centerX + 90, y: centerY + 70 }, { x: centerX - 90, y: centerY + 70 }];
        return { vertices: coordinates.map((point, id) => ({ ...point, id, name: String.fromCharCode(65 + id) })), edges: [{ u: 0, v: 1, weight: 2 }, { u: 1, v: 2, weight: 4 }, { u: 2, v: 3, weight: 1 }, { u: 3, v: 0, weight: 3 }, { u: 0, v: 2, weight: 5 }, { u: 1, v: 3, weight: 2 }] };
    }
    if (type === 'petersen') {
        const vertices = circleVertices(10, 145);
        const edges = weighted([
            [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
            [5, 7], [7, 9], [9, 6], [6, 8], [8, 5],
            [0, 5], [1, 6], [2, 7], [3, 8], [4, 9]
        ]);
        return { vertices, edges };
    }
    if (type === 'complete') {
        const vertices = circleVertices(5, 125);
        const pairs = [];
        for (let u = 0; u < 5; u += 1) for (let v = u + 1; v < 5; v += 1) pairs.push([u, v]);
        return { vertices, edges: weighted(pairs) };
    }
    if (type === 'star') {
        const vertices = [{ id: 0, name: 'A', x: centerX, y: centerY }, ...circleVertices(5, 135).map((vertex, index) => ({ ...vertex, id: index + 1, name: String.fromCharCode(66 + index) }))];
        return { vertices, edges: weighted([[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]) };
    }
    if (type === 'bipartite') {
        const left = [0, 1, 2].map((id, index) => ({ id, name: String.fromCharCode(65 + id), x: centerX - 130, y: centerY - 100 + index * 100 }));
        const right = [3, 4, 5].map((id, index) => ({ id, name: String.fromCharCode(65 + id), x: centerX + 130, y: centerY - 100 + index * 100 }));
        const pairs = [];
        left.forEach(vertex => right.forEach(other => pairs.push([vertex.id, other.id])));
        return { vertices: [...left, ...right], edges: weighted(pairs) };
    }
    if (type === 'wheel') {
        const vertices = [{ id: 0, name: 'A', x: centerX, y: centerY }, ...circleVertices(5, 135).map((vertex, index) => ({ ...vertex, id: index + 1, name: String.fromCharCode(66 + index) }))];
        const rim = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 1]];
        return { vertices, edges: weighted([...rim, [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]) };
    }
    const vertices = Array.from({ length: 5 }, (_, id) => ({ id, name: String.fromCharCode(65 + id), ...randomPosition(id, 5, rect.width, rect.height) }));
    if (type === 'hamiltonian') return { vertices, edges: [{ u: 0, v: 1, weight: 2 }, { u: 1, v: 2, weight: 3 }, { u: 2, v: 3, weight: 1 }, { u: 3, v: 4, weight: 4 }, { u: 4, v: 0, weight: 2 }, { u: 0, v: 2, weight: 5 }] };
    return { vertices, edges: weighted([[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]]) };
}

function loadPreset(type) { setGraph(...Object.values(createPreset(type))); }

function clearGraph() { setGraph([], []); }

function setMode(mode) {
    state.mode = mode;
    state.selectedVertex = null;
    dom.modeVertex.classList.toggle('is-active', mode === 'vertex');
    dom.modeEdge.classList.toggle('is-active', mode === 'edge');
    drawGraph();
}

function addVertex(point) {
    const id = state.vertices.length ? Math.max(...state.vertices.map(vertex => vertex.id)) + 1 : 0;
    state.vertices = [...state.vertices, { id, name: String.fromCharCode(65 + id), x: point.x, y: point.y }];
    resetAnalysis();
    updateSelectors();
    updateStats();
    drawGraph();
}

function addEdge(start, end) {
    if (start.id === end.id) return;
    if (edgeBetween(start.id, end.id)) {
        showError('Hai đỉnh này đã có cạnh. Đồ thị hiện hỗ trợ mỗi cặp đỉnh một cạnh.');
        return;
    }
    const weight = Number(dom.edgeWeight.value);
    if (!Number.isFinite(weight)) {
        showError('Trọng số cạnh phải là một số hợp lệ.');
        return;
    }
    state.edges = [...state.edges, { id: state.nextEdgeId, u: start.id, v: end.id, weight }];
    state.nextEdgeId += 1;
    resetAnalysis();
    updateStats();
    drawGraph();
}

function connected(adjacency, includeIsolated = true) {
    if (state.vertices.length === 0) return false;
    const candidates = includeIsolated ? state.vertices.map(vertex => vertex.id) : state.vertices.filter(vertex => adjacency[vertex.id].length > 0).map(vertex => vertex.id);
    if (candidates.length === 0) return state.edges.length === 0;
    const visited = new Set([candidates[0]]);
    const queue = [candidates[0]];
    while (queue.length) {
        const current = queue.shift();
        adjacency[current].forEach(item => { if (!visited.has(item.id)) { visited.add(item.id); queue.push(item.id); } });
    }
    return candidates.every(id => visited.has(id));
}

function findEuler(adjacency) {
    const relevant = state.vertices.filter(vertex => adjacency[vertex.id].length > 0);
    if (relevant.length === 0 || !connected(adjacency, false)) return { type: 'none', path: [], odd: [] };
    const odd = relevant.filter(vertex => adjacency[vertex.id].length % 2).map(vertex => vertex.id);
    if (odd.length !== 0 && odd.length !== 2) return { type: 'none', path: [], odd };
    const start = odd[0] ?? relevant[0].id;
    const unused = new Set(state.edges.map(edge => edge.id));
    const stack = [start];
    const path = [];
    while (stack.length) {
        const current = stack[stack.length - 1];
        const next = adjacency[current].find(item => unused.has(item.edgeId));
        if (next) { unused.delete(next.edgeId); stack.push(next.id); } else path.push(stack.pop());
    }
    const route = path.reverse();
    const valid = unused.size === 0 && route.length === state.edges.length + 1;
    return { type: valid ? odd.length === 0 ? 'circuit' : 'path' : 'none', path: valid ? route : [], odd };
}

function findHamilton(adjacency) {
    if (state.vertices.length < 3 || !connected(adjacency, true)) return [];
    const start = state.vertices[0].id;
    const visited = new Set([start]);
    const path = [start];
    function search(current) {
        if (path.length === state.vertices.length) return Boolean(adjacency[current].some(item => item.id === start));
        return adjacency[current].some(item => {
            if (visited.has(item.id)) return false;
            visited.add(item.id); path.push(item.id);
            if (search(item.id)) return true;
            path.pop(); visited.delete(item.id); return false;
        });
    }
    return search(start) ? [...path, start] : [];
}

function disjointSet() {
    const parent = Object.fromEntries(state.vertices.map(vertex => [vertex.id, vertex.id]));
    const find = id => { while (parent[id] !== id) { parent[id] = parent[parent[id]]; id = parent[id]; } return id; };
    const union = (a, b) => { const rootA = find(a); const rootB = find(b); if (rootA === rootB) return false; parent[rootB] = rootA; return true; };
    return { union };
}

function kruskal() {
    const set = disjointSet();
    const selected = [];
    [...state.edges].sort((a, b) => a.weight - b.weight).forEach(edge => { if (set.union(edge.u, edge.v)) selected.push(edge); });
    return { edges: selected, total: selected.reduce((sum, edge) => sum + edge.weight, 0), isTree: selected.length === Math.max(0, state.vertices.length - 1) && connected(graphAdjacency(), true) };
}

function prim() {
    if (!connected(graphAdjacency(), true)) return { edges: [], total: 0, isTree: false };
    const adjacency = graphAdjacency();
    const visited = new Set([state.vertices[0]?.id]);
    const selected = [];
    while (visited.size < state.vertices.length) {
        const candidates = state.edges.filter(edge => (visited.has(edge.u) && !visited.has(edge.v)) || (visited.has(edge.v) && !visited.has(edge.u))).sort((a, b) => a.weight - b.weight);
        const edge = candidates[0];
        if (!edge) return { edges: [], total: 0, isTree: false };
        selected.push(edge); visited.add(edge.u); visited.add(edge.v);
    }
    return { edges: selected, total: selected.reduce((sum, edge) => sum + edge.weight, 0), isTree: selected.length === state.vertices.length - 1 };
}

function shortestPath(sourceId, algorithm) {
    const ids = state.vertices.map(vertex => vertex.id);
    const distances = Object.fromEntries(ids.map(id => [id, Infinity]));
    const previous = Object.fromEntries(ids.map(id => [id, null]));
    distances[sourceId] = 0;
    const steps = [{ description: `${algorithm}: bắt đầu tại ${vertexName(sourceId)}`, vertices: [sourceId], edges: [] }];
    const relax = (from, to, weight, edgeId) => {
        if (distances[from] !== Infinity && distances[from] + weight < distances[to]) {
            distances[to] = distances[from] + weight; previous[to] = { id: from, edgeId };
            return true;
        }
        return false;
    };
    if (algorithm === 'Dijkstra') {
        const settled = new Set();
        while (settled.size < ids.length) {
            const current = ids.filter(id => !settled.has(id)).sort((a, b) => distances[a] - distances[b])[0];
            if (current === undefined || distances[current] === Infinity) break;
            settled.add(current);
            graphAdjacency()[current].forEach(item => relax(current, item.id, item.weight, item.edgeId));
            steps.push({ description: `Dijkstra: chốt ${vertexName(current)} với khoảng cách ${distances[current]}`, vertices: [...settled], edges: [] });
        }
    } else {
        for (let pass = 1; pass < ids.length; pass += 1) {
            let changed = false;
            state.edges.forEach(edge => {
                changed = relax(edge.u, edge.v, edge.weight, edge.id) || changed;
                changed = relax(edge.v, edge.u, edge.weight, edge.id) || changed;
            });
            steps.push({ description: `Bellman-Ford: lần lặp ${pass}/${ids.length - 1}`, vertices: ids.filter(id => distances[id] !== Infinity), edges: [] });
            if (!changed) break;
        }
    }
    const negativeCycle = algorithm === 'Bellman-Ford' && state.edges.some(edge => (distances[edge.u] !== Infinity && distances[edge.u] + edge.weight < distances[edge.v]) || (distances[edge.v] !== Infinity && distances[edge.v] + edge.weight < distances[edge.u]));
    return { distances, previous, negativeCycle, steps };
}

function pathForTarget(result, targetId) {
    if (result.distances[targetId] === Infinity || result.negativeCycle) return [];
    const path = [];
    const seen = new Set();
    let current = targetId;
    while (current !== null && !seen.has(current)) {
        seen.add(current); path.unshift(current); current = result.previous[current]?.id ?? null;
    }
    return path;
}

function formatPath(path) { return path.length ? path.map(vertexName).join(' → ') : 'Không có'; }
function formatDistance(distance) { return distance === Infinity ? '∞' : String(distance); }

function analyzeGraph() {
    if (state.vertices.length === 0) { showError('Đồ thị trống. Hãy thêm đỉnh hoặc sinh đồ thị.'); return; }
    const adjacency = graphAdjacency();
    const euler = findEuler(adjacency);
    const hamilton = findHamilton(adjacency);
    const mstKruskal = kruskal();
    const mstPrim = prim();
    const sourceId = Number(dom.source.value || state.vertices[0].id);
    const targetId = Number(dom.target.value || state.vertices[state.vertices.length - 1].id);
    const hasNegative = state.edges.some(edge => edge.weight < 0);
    const dijkstra = hasNegative ? { error: 'Dijkstra không chạy được vì đồ thị có cạnh âm.' } : shortestPath(sourceId, 'Dijkstra');
    const bellmanFord = shortestPath(sourceId, 'Bellman-Ford');
    state.analysis = { euler, hamilton, mstKruskal, mstPrim, dijkstra, bellmanFord, sourceId, targetId, selectedAlgorithms: selectedAnalysisAlgorithms() };
    renderAnalysis();
    prepareAnimation();
}

function renderAnalysis() {
    const analysis = state.analysis;
    const selected = analysis.selectedAlgorithms;
    const connectedAll = connected(graphAdjacency(), true);
    const sourceName = vertexName(analysis.sourceId);
    const dijkstraLine = analysis.dijkstra.error ? `<span class="text-rose-500">${analysis.dijkstra.error}</span>` : `${escapeHtml(sourceName)}→đích: ${escapeHtml(formatDistance(analysis.dijkstra.distances[analysis.targetId]))}`;
    const bellmanLine = analysis.bellmanFord.negativeCycle ? '<span class="text-rose-500">Phát hiện chu trình âm có thể đi tới.</span>' : `${escapeHtml(sourceName)}→đích: ${escapeHtml(formatDistance(analysis.bellmanFord.distances[analysis.targetId]))}`;
    const lines = [`<p><strong>Liên thông:</strong> <span class="${connectedAll ? 'text-emerald-500' : 'text-rose-500'}">${connectedAll ? 'Có' : 'Không'}</span></p>`];
    if (selected.has('euler')) lines.push(`<p><strong>Euler:</strong> <span class="${analysis.euler.type === 'none' ? 'text-slate-500' : 'text-emerald-500'}">${analysis.euler.type === 'circuit' ? 'Có chu trình' : analysis.euler.type === 'path' ? 'Có đường đi' : `Không có (bậc lẻ: ${analysis.euler.odd.length})`}</span></p>${analysis.euler.path.length ? `<p class="truncate">${escapeHtml(formatPath(analysis.euler.path))}</p>` : ''}`);
    if (selected.has('hamilton')) lines.push(`<p><strong>Hamilton:</strong> <span class="${analysis.hamilton.length ? 'text-emerald-500' : 'text-slate-500'}">${analysis.hamilton.length ? 'Có chu trình' : 'Không tìm thấy'}</span></p>${analysis.hamilton.length ? `<p class="truncate">${escapeHtml(formatPath(analysis.hamilton))}</p>` : ''}`);
    if (selected.has('kruskal')) lines.push(`<p><strong>Kruskal:</strong> <span class="${analysis.mstKruskal.isTree ? 'text-emerald-500' : 'text-amber-500'}">${analysis.mstKruskal.isTree ? `MST = ${analysis.mstKruskal.total}` : 'Rừng khung'}</span></p>`);
    if (selected.has('prim')) lines.push(`<p><strong>Prim:</strong> <span class="${analysis.mstPrim.isTree ? 'text-emerald-500' : 'text-rose-500'}">${analysis.mstPrim.isTree ? `MST = ${analysis.mstPrim.total}` : 'Cần đồ thị liên thông'}</span></p>`);
    if (selected.has('dijkstra')) lines.push(`<p><strong>Dijkstra:</strong> ${dijkstraLine}</p>`);
    if (selected.has('bellmanFord')) lines.push(`<p><strong>Bellman-Ford:</strong> ${bellmanLine}</p>`);
    if (selected.has('dijkstra') || selected.has('bellmanFord')) lines.push(`<p class="text-slate-400">Nguồn: ${escapeHtml(vertexName(analysis.sourceId))} · Đích: ${escapeHtml(vertexName(analysis.targetId))}</p>`);
    dom.result.innerHTML = `<div class="space-y-2.5">${lines.join('')}</div>`;
}

function edgeSteps(edges, label) {
    const steps = [{ description: `${label}: bắt đầu`, vertices: [], edges: [] }];
    const selectedVertices = new Set();
    edges.forEach((edge, index) => { selectedVertices.add(edge.u); selectedVertices.add(edge.v); steps.push({ description: `${label}: chọn cạnh ${vertexName(edge.u)}-${vertexName(edge.v)} (w=${edge.weight}) · bước ${index + 1}/${edges.length}`, vertices: [...selectedVertices], edges: edges.slice(0, index + 1) }); });
    return steps;
}

function prepareAnimation() {
    const analysis = state.analysis;
    if (!analysis) return;
    const selected = analysis.selectedAlgorithms;
    if (selected.has('kruskal') && analysis.mstKruskal.edges.length) state.animationSteps = edgeSteps(analysis.mstKruskal.edges, 'Kruskal');
    else if (selected.has('prim') && analysis.mstPrim.edges.length) state.animationSteps = edgeSteps(analysis.mstPrim.edges, 'Prim');
    else if (selected.has('dijkstra') && !analysis.dijkstra.error) state.animationSteps = analysis.dijkstra.steps;
    else if (selected.has('bellmanFord') && analysis.bellmanFord.steps.length) state.animationSteps = analysis.bellmanFord.steps;
    else if (selected.has('euler') && analysis.euler.path.length) state.animationSteps = edgeSteps(analysis.euler.path.slice(1).map((id, index) => edgeBetween(analysis.euler.path[index], id)).filter(Boolean), 'Euler');
    else if (selected.has('hamilton') && analysis.hamilton.length) state.animationSteps = edgeSteps(analysis.hamilton.slice(1).map((id, index) => edgeBetween(analysis.hamilton[index], id)).filter(Boolean), 'Hamilton');
    state.animationIndex = 0;
    const enabled = state.animationSteps.length > 0;
    dom.step.disabled = !enabled;
    dom.play.disabled = !enabled;
}

function showAnimationStep(index) {
    if (!state.animationSteps.length) return;
    const step = state.animationSteps[index];
    dom.animationDescription.textContent = step.description;
    drawGraph(step.vertices ?? [], step.edges ?? []);
}

function startAnimation() {
    if (!state.animationSteps.length || state.animationTimer) return;
    state.animationTimer = setInterval(() => { showAnimationStep(state.animationIndex); state.animationIndex = (state.animationIndex + 1) % state.animationSteps.length; }, state.animationSpeed);
    dom.animationPausePlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
}

function stopAnimation() {
    if (state.animationTimer) clearInterval(state.animationTimer);
    state.animationTimer = null;
    dom.animationPausePlay.innerHTML = '<i class="fa-solid fa-play"></i>';
}

function showError(message) { dom.result.innerHTML = `<p class="text-rose-500">${message}</p>`; }

function bindEvents() {
    dom.randomCount.addEventListener('input', event => { dom.randomCountValue.textContent = event.target.value; });
    document.getElementById('btnGenerateRandom').addEventListener('click', generateRandomGraph);
    document.getElementById('btnAnalyze').addEventListener('click', analyzeGraph);
    document.getElementById('btnClear').addEventListener('click', clearGraph);
    document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => loadPreset(button.dataset.preset)));
    dom.modeVertex.addEventListener('click', () => setMode('vertex'));
    dom.modeEdge.addEventListener('click', () => setMode('edge'));
    document.getElementById('btnToggleMatrix').addEventListener('click', () => dom.matrixContainer.classList.toggle('hidden'));
    document.getElementById('themeToggle').addEventListener('click', () => { document.documentElement.classList.toggle('dark'); drawGraph(); });
    document.getElementById('btnHelp').addEventListener('click', () => document.getElementById('helpModal').classList.remove('hidden'));
    document.getElementById('btnCloseHelp').addEventListener('click', () => document.getElementById('helpModal').classList.add('hidden'));
    document.getElementById('btnUnderstand').addEventListener('click', () => document.getElementById('helpModal').classList.add('hidden'));
    dom.step.addEventListener('click', () => { dom.animationBar.classList.remove('hidden'); dom.animationBar.classList.add('flex'); showAnimationStep(state.animationIndex); state.animationIndex = (state.animationIndex + 1) % state.animationSteps.length; });
    dom.play.addEventListener('click', () => { dom.animationBar.classList.remove('hidden'); dom.animationBar.classList.add('flex'); state.animationTimer ? stopAnimation() : startAnimation(); });
    dom.animationPausePlay.addEventListener('click', () => state.animationTimer ? stopAnimation() : startAnimation());
    document.getElementById('animPrev').addEventListener('click', () => { state.animationIndex = (state.animationIndex - 1 + state.animationSteps.length) % state.animationSteps.length; showAnimationStep(state.animationIndex); });
    document.getElementById('animNext').addEventListener('click', () => { state.animationIndex = (state.animationIndex + 1) % state.animationSteps.length; showAnimationStep(state.animationIndex); });

    dom.canvas.addEventListener('pointerdown', event => {
        const point = canvasPoint(event);
        const vertex = findVertexAt(point);
        state.didDrag = false;
        if (vertex) {
            state.draggingVertex = vertex;
            dom.canvas.setPointerCapture(event.pointerId);
        }
        else if (state.mode === 'vertex') addVertex(point);
    });
    dom.canvas.addEventListener('pointermove', event => {
        const point = canvasPoint(event);
        if (state.draggingVertex) { state.draggingVertex.x = point.x; state.draggingVertex.y = point.y; state.didDrag = true; drawGraph(); return; }
        state.hoveredVertex = findVertexAt(point);
        dom.canvas.style.cursor = state.hoveredVertex ? 'pointer' : state.mode === 'vertex' ? 'crosshair' : 'default';
        drawGraph();
    });
    dom.canvas.addEventListener('pointerup', event => {
        state.draggingVertex = null;
        if (dom.canvas.hasPointerCapture(event.pointerId)) dom.canvas.releasePointerCapture(event.pointerId);
    });
    dom.canvas.addEventListener('pointerleave', () => { if (!state.draggingVertex) state.hoveredVertex = null; });
    dom.canvas.addEventListener('click', event => {
        if (state.didDrag || state.mode !== 'edge') return;
        const vertex = findVertexAt(canvasPoint(event));
        if (!vertex) return;
        if (!state.selectedVertex) state.selectedVertex = vertex;
        else if (state.selectedVertex.id === vertex.id) state.selectedVertex = null;
        else { addEdge(state.selectedVertex, vertex); state.selectedVertex = null; }
        drawGraph();
    });
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', () => { bindEvents(); resizeCanvas(); loadPreset('both'); });
