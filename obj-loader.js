// Loader Avançado: Suporta arquivos .mtl e múltiplos grupos (parts)
export async function loadOBJ(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Não foi possível carregar: ${url}`);
        const text = await response.text();

        const positions = [];
        const texCoords = [];
        const normals = [];
        
        // Lista de grupos. Ex: [{ material: 'Tronco', data: ... }, { material: 'Folhas', ... }]
        const groups = [];
        
        // Grupo atual sendo processado
        let currentGroup = {
            material: 'default',
            vertices: [], // Lista temporária de vértices
            count: 0
        };

        const lines = text.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) continue;

            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === 'v') {
                // Vértice (Posição X, Y, Z)
                positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } 
            else if (type === 'vt') {
                // Coordenada de Textura (U, V)
                texCoords.push([parseFloat(parts[1]), parseFloat(parts[2])]);
            } 
            else if (type === 'vn') {
                // Normal (Iluminação)
                normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
            } 
            else if (type === 'usemtl') {
                // Troca de Material! Salva o grupo anterior e cria um novo.
                if (currentGroup.vertices.length > 0) {
                    currentGroup.data = new Float32Array(currentGroup.vertices);
                    groups.push(currentGroup);
                }
                currentGroup = {
                    material: parts[1], // Nome do material (ex: 'Bark', 'Leaves')
                    vertices: [],
                    count: 0
                };
            } 
            else if (type === 'f') {
                // Face (Triângulo)
                // Processa os vértices da face (triangula se for quadrado)
                const numVerts = parts.length - 1;
                for (let j = 0; j < numVerts - 2; j++) {
                    processVertex(parts[1], positions, texCoords, normals, currentGroup);
                    processVertex(parts[2 + j], positions, texCoords, normals, currentGroup);
                    processVertex(parts[3 + j], positions, texCoords, normals, currentGroup);
                }
            }
        }

        // Adiciona o último grupo processado
        if (currentGroup.vertices.length > 0) {
            currentGroup.data = new Float32Array(currentGroup.vertices);
            groups.push(currentGroup);
        }

        return groups; 
    } catch (e) {
        console.error("Erro no loader OBJ:", e);
        return [];
    }
}

// Função auxiliar para organizar os dados do vértice
function processVertex(facePart, p, vt, vn, group) {
    const indices = facePart.split('/');
    
    // Índices no OBJ começam em 1, subtraímos 1 para array
    const pIdx = parseInt(indices[0]) - 1;
    const tIdx = indices[1] ? parseInt(indices[1]) - 1 : -1;
    const nIdx = indices[2] ? parseInt(indices[2]) - 1 : -1;

    // Busca os dados nos arrays globais
    const v = p[pIdx] || [0, 0, 0];
    const t = (tIdx >= 0 && vt[tIdx]) ? vt[tIdx] : [0, 0];
    const n = (nIdx >= 0 && vn[nIdx]) ? vn[nIdx] : [0, 1, 0];

    // Adiciona no buffer do grupo atual (Interleaved: X,Y,Z, U,V, NX,NY,NZ)
    group.vertices.push(v[0], v[1], v[2]); // Posição
    group.vertices.push(t[0], t[1]);       // Textura
    group.vertices.push(n[0], n[1], n[2]); // Normal
    
    group.count++; // Conta +1 vértice
}