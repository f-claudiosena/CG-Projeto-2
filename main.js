import { mat4, vec3, mat3, vec4 } from 'https://cdn.skypack.dev/gl-matrix';
import { loadOBJ as loadComplexOBJ } from './obj-loader.js';

// ==========================================
// 1. UTILITÁRIOS (Helpers)
// ==========================================

// Carrega arquivo .MTL para saber os nomes das texturas
async function loadMTL(url) {
    try {
        const res = await fetch(url);
        const text = await res.text();
        const materials = {};
        let currentMaterial = null;

        text.split('\n').forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts[0] === 'newmtl') {
                currentMaterial = parts[1];
                materials[currentMaterial] = { map: null };
            } else if (parts[0] === 'map_Kd' && currentMaterial) {
                materials[currentMaterial].map = parts[1]; // Nome do arquivo de imagem
            }
        });
        return materials;
    } catch (e) {
        console.warn("MTL não encontrado ou erro:", e);
        return {};
    }
}

// Carrega Imagem e cria Textura WebGL
function loadTexture(gl, url) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Placeholder cinza enquanto carrega
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128,128,128,255]));
    
    const img = new Image();
    // Cache buster para garantir que a imagem atualize se você mudar o arquivo
    const noCacheUrl = url + '?v=' + Date.now(); 
    
    img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    };
    img.onerror = () => console.warn(`Textura falhou: ${url}`);
    img.src = noCacheUrl;
    return tex;
}

// Loader Simples para objetos que são uma peça só (Arma, Inimigo)
// Isso evita que eles se dividam e buguem a animação
async function loadSimpleOBJ(url) {
    try {
        const r = await fetch(url + '?v=' + Date.now());
        if (!r.ok) throw new Error(url);
        const text = await r.text();
        const p = [], t = [], n = [], res = [];
        text.split('\n').forEach(line => {
            const pts = line.trim().split(/\s+/);
            if (pts[0] === 'v') p.push(pts.slice(1).map(Number));
            else if (pts[0] === 'vt') t.push(pts.slice(1).map(Number));
            else if (pts[0] === 'vn') n.push(pts.slice(1).map(Number));
            else if (pts[0] === 'f') {
                for (let i = 1; i <= 3; i++) {
                    const idx = pts[i].split('/');
                    const vIdx = parseInt(idx[0]) - 1;
                    const tIdx = idx[1] ? parseInt(idx[1]) - 1 : -1;
                    const nIdx = idx[2] ? parseInt(idx[2]) - 1 : -1;
                    res.push(...(p[vIdx] || [0, 0, 0]));
                    res.push(...(t[tIdx] || [0, 0]));
                    res.push(...(n[nIdx] || [0, 1, 0]));
                }
            }
        });
        return new Float32Array(res);
    } catch (e) {
        return createCubeData(); // Se falhar, retorna um cubo
    }
}

// Dados geométricos manuais (Cubo)
function createCubeData() {
    const v = [
        // Frente
        -0.5, -0.5,  0.5, 0,0, 0,0,1,  0.5, -0.5,  0.5, 1,0, 0,0,1,  0.5,  0.5,  0.5, 1,1, 0,0,1,
        -0.5, -0.5,  0.5, 0,0, 0,0,1,  0.5,  0.5,  0.5, 1,1, 0,0,1, -0.5,  0.5,  0.5, 0,1, 0,0,1,
        // Trás
        -0.5, -0.5, -0.5, 0,0, 0,0,-1, -0.5,  0.5, -0.5, 0,1, 0,0,-1,  0.5,  0.5, -0.5, 1,1, 0,0,-1,
        -0.5, -0.5, -0.5, 0,0, 0,0,-1,  0.5,  0.5, -0.5, 1,1, 0,0,-1,  0.5, -0.5, -0.5, 1,0, 0,0,-1,
        // Topo
        -0.5,  0.5, -0.5, 0,1, 0,1,0,  -0.5,  0.5,  0.5, 0,0, 0,1,0,   0.5,  0.5,  0.5, 1,0, 0,1,0,
        -0.5,  0.5, -0.5, 0,1, 0,1,0,   0.5,  0.5,  0.5, 1,0, 0,1,0,   0.5,  0.5, -0.5, 1,1, 0,1,0,
        // Baixo
        -0.5, -0.5, -0.5, 0,1, 0,-1,0,  0.5, -0.5, -0.5, 1,1, 0,-1,0,  0.5, -0.5,  0.5, 1,0, 0,-1,0,
        -0.5, -0.5, -0.5, 0,1, 0,-1,0,  0.5, -0.5,  0.5, 1,0, 0,-1,0, -0.5, -0.5,  0.5, 0,0, 0,-1,0,
        // Direita
         0.5, -0.5, -0.5, 0,0, 1,0,0,   0.5,  0.5, -0.5, 0,1, 1,0,0,   0.5,  0.5,  0.5, 1,1, 1,0,0,
         0.5, -0.5, -0.5, 0,0, 1,0,0,   0.5,  0.5,  0.5, 1,1, 1,0,0,   0.5, -0.5,  0.5, 1,0, 1,0,0,
        // Esquerda
        -0.5, -0.5, -0.5, 0,0, -1,0,0, -0.5, -0.5,  0.5, 1,0, -1,0,0, -0.5,  0.5,  0.5, 1,1, -1,0,0,
        -0.5, -0.5, -0.5, 0,0, -1,0,0, -0.5,  0.5,  0.5, 1,1, -1,0,0, -0.5,  0.5, -0.5, 0,1, -1,0,0
    ];
    return new Float32Array(v);
}

// Dados geométricos manuais (Esfera para o sol/tiro)
function createSphereData(radius) {
    const lat = 12, lon = 12;
    const v = [];
    for (let i = 0; i <= lat; i++) {
        const theta = i * Math.PI / lat;
        for (let j = 0; j <= lon; j++) {
            const phi = j * 2 * Math.PI / lon;
            const x = Math.sin(phi) * Math.sin(theta);
            const y = Math.cos(theta);
            const z = Math.cos(phi) * Math.sin(theta);
            if (i < lat && j < lon) {
                const add = (t, p) => {
                    const st = Math.sin(t), ct = Math.cos(t), sp = Math.sin(p), cp = Math.cos(p);
                    const vx = cp * st, vy = ct, vz = sp * st;
                    v.push(vx * radius, vy * radius, vz * radius, 0, 0, vx, vy, vz);
                };
                add(theta, phi);
                add((i + 1) * Math.PI / lat, phi);
                add(theta, (j + 1) * 2 * Math.PI / lon);
                add((i + 1) * Math.PI / lat, phi);
                add((i + 1) * Math.PI / lat, (j + 1) * 2 * Math.PI / lon);
                add(theta, (j + 1) * 2 * Math.PI / lon);
            }
        }
    }
    return new Float32Array(v);
}

// Dados do Chão (Floor)
function createFloorData(size) {
    const s = size / 2;
    return new Float32Array([
        -s, 0, s, 0, 0, 0, 1, 0, 
         s, 0, s, 1, 0, 0, 1, 0, 
        -s, 0, -s, 0, 1, 0, 1, 0, 
        -s, 0, -s, 0, 1, 0, 1, 0, 
         s, 0, s, 1, 0, 0, 1, 0, 
         s, 0, -s, 1, 1, 0, 1, 0
    ]);
}

// ==========================================
// 2. SHADERS (CÓDIGO GLSL)
// ==========================================

const shadowVsSource = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uLightSpaceMatrix;
uniform mat4 uModel;
void main() { 
    gl_Position = uLightSpaceMatrix * uModel * vec4(aPos, 1.0); 
}`;

const shadowFsSource = `#version 300 es
precision mediump float;
void main() {}`;

const vsSource = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aTex;
layout(location=2) in vec3 aNorm;

uniform mat4 uProj, uView, uModel;
uniform mat3 uNormMat;
uniform mat4 uLightSpaceMatrix;
uniform vec2 uTexScale; 

out vec3 vPos;
out vec3 vNorm;
out vec2 vTex;
out vec4 vPosLightSpace;

void main() {
    vPos = vec3(uModel * vec4(aPos, 1.0));
    vNorm = normalize(uNormMat * aNorm);
    vTex = aTex * uTexScale; 
    vPosLightSpace = uLightSpaceMatrix * vec4(vPos, 1.0);
    gl_Position = uProj * uView * vec4(vPos, 1.0);
}`;

const fsSource = `#version 300 es
precision mediump float;

in vec3 vPos;
in vec3 vNorm;
in vec2 vTex;
in vec4 vPosLightSpace;

uniform vec3 uLightPos, uViewPos, uLightCol, uObjCol;
uniform float uFlash;
uniform sampler2D uSampler;
uniform sampler2D uShadowMap;
uniform bool uUseTex;
uniform bool uIsSun;

out vec4 fCol;

float ShadowCalculation(vec4 fragPosLightSpace, vec3 normal, vec3 lightDir) {
    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;
    if(projCoords.z > 1.0) return 0.0;
    
    float currentDepth = projCoords.z;
    float bias = max(0.005 * (1.0 - dot(normal, lightDir)), 0.005); 
    
    // Leitura simples do mapa de sombra
    float pcfDepth = texture(uShadowMap, projCoords.xy).r; 
    float shadow = currentDepth - bias > pcfDepth ? 1.0 : 0.0;
    
    return shadow;
}

void main() {
    if(uIsSun) { 
        fCol = vec4(uLightCol, 1.0); 
        return; 
    }

    vec3 color = uObjCol;
    if(uUseTex) {
        vec4 texColor = texture(uSampler, vTex);
        // Alpha Test para as folhas da árvore
        if(texColor.a < 0.1) discard; 
        color = texColor.rgb * uObjCol; 
    }

    vec3 normal = normalize(vNorm);
    vec3 lightDir = normalize(uLightPos - vPos);
    
    // Iluminação Phong
    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diff * uLightCol * color;
    vec3 ambient = 0.4 * color;

    float shadow = ShadowCalculation(vPosLightSpace, normal, lightDir);
    vec3 lighting = (ambient + (1.0 - shadow) * diffuse) + (uFlash * color);
    
    fCol = vec4(lighting, 1.0);
}`;

// ==========================================
// 3. LÓGICA DO JOGO (CLASSES)
// ==========================================

let gameScore = 0;
const scoreElement = document.getElementById('score-board');

function updateScore(points) {
    gameScore += points;
    if (scoreElement) scoreElement.innerText = `PONTOS: ${gameScore}`;
}

class Bolsonaro {
    constructor(isSuper = false) {
        const side = Math.floor(Math.random() * 4);
        const dist = 65;
        const offset = (Math.random() - 0.5) * 80;

        if (side === 0) this.pos = vec3.fromValues(offset, 0, -dist);
        else if (side === 1) this.pos = vec3.fromValues(offset, 0, dist);
        else if (side === 2) this.pos = vec3.fromValues(dist, 0, offset);
        else this.pos = vec3.fromValues(-dist, 0, offset);

        if (isSuper) {
            this.isSuper = true;
            this.hp = 2;
            this.scaleVal = 2.2;
            this.color = [1.0, 0.5, 0.5];
            this.speed = 0.025 + Math.random() * 0.01;
            this.audioFile = 'ninguem-pega-meu-telefone.mp3';
            this.deathSound = 'pegaram-meu-telefone.mp3';
            this.points = 50;
        } else {
            this.isSuper = false;
            this.hp = 1;
            this.scaleVal = 0.8;
            this.color = [1.0, 1.0, 1.0];
            this.speed = 0.04 + Math.random() * 0.03;
            this.audioFile = 'taok.mp3';
            this.deathSound = null;
            this.points = 10;
        }

        this.alive = true;
        this.angle = 0;
        this.audio = new Audio(this.audioFile);
        this.nextTalkTime = Date.now() + Math.random() * 3000;
    }

    update(playerPos) {
        if (!this.alive) return;

        const dir = vec3.create();
        vec3.subtract(dir, playerPos, this.pos);
        const distToPlayer = vec3.length(dir);
        dir[1] = 0;
        this.angle = Math.atan2(dir[0], dir[2]);
        vec3.normalize(dir, dir);
        vec3.scaleAndAdd(this.pos, this.pos, dir, this.speed);

        this.pos[1] = Math.abs(Math.sin(Date.now() * 0.015)) * (this.isSuper ? 0.3 : 0.1);

        if (Date.now() > this.nextTalkTime) {
            this.audio.currentTime = 0;
            this.audio.play().catch(() => {});
            this.nextTalkTime = Date.now() + 3000 + Math.random() * 2000;
        }

        let volume = 1.0 - (distToPlayer / 50.0);
        if (volume < 0) volume = 0;
        if (volume > 1) volume = 1;
        this.audio.volume = volume;
    }

    takeDamage(isStrongShot) {
        if (this.isSuper) {
            if (isStrongShot) this.hp--;
        } else {
            this.hp--;
        }

        if (this.hp <= 0) {
            this.die();
            return true;
        }
        return false;
    }

    die() {
        this.alive = false;
        this.audio.pause();
        if (this.deathSound) {
            const snd = new Audio(this.deathSound);
            snd.volume = 1.0;
            snd.play().catch(() => {});
        }
        updateScore(this.points);
    }
}

class Projectile {
    constructor(pos, dir, speed) {
        this.pos = vec3.clone(pos);
        this.vel = vec3.create();
        vec3.scale(this.vel, dir, speed);

        this.isStrong = (speed >= 2.9);
        this.color = this.isStrong ? [1.0, 0.0, 0.0] : [1.0, 0.5 + (speed / 6.0), 0.0];
        this.life = 600;
        this.radius = 0.2;
        this.restitution = 0.8;
        this.hitList = [];
    }

    update(trees, walls, enemies) {
        this.vel[1] -= 0.015;
        vec3.add(this.pos, this.pos, this.vel);

        if (this.pos[1] < this.radius) {
            this.pos[1] = this.radius;
            this.vel[1] *= -this.restitution;
            this.vel[0] *= 0.98;
            this.vel[2] *= 0.98;
        }

        // Colisão Árvores
        for (let t of trees) {
            const dx = this.pos[0] - t.x;
            const dz = this.pos[2] - t.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.8) {
                const nx = dx / dist;
                const nz = dz / dist;
                const dot = this.vel[0] * nx + this.vel[2] * nz;
                this.vel[0] -= 2 * dot * nx;
                this.vel[2] -= 2 * dot * nz;
                this.pos[0] += nx * 0.1;
                this.pos[2] += nz * 0.1;
                this.vel[0] *= 0.7;
                this.vel[2] *= 0.7;
            }
        }

        // Colisão Paredes
        for (let w of walls) {
            const dx = this.pos[0] - w.pos[0];
            const dz = this.pos[2] - w.pos[2];
            const extentX = (w.scale[0] / 2) + this.radius;
            const extentZ = (w.scale[2] / 2) + this.radius;
            if (Math.abs(dx) < extentX && Math.abs(dz) < extentZ) {
                this.vel[0] *= -0.6;
                this.vel[2] *= -0.6;
                vec3.add(this.pos, this.pos, this.vel);
            }
        }

        // Colisão Inimigos (HITBOX AUMENTADA 2.5x)
        for (let b of enemies) {
            if (b.alive) {
                if (!this.hitList.includes(b)) {
                    const dist = vec3.distance(this.pos, b.pos);
                    // Hitbox maior para facilitar
                    const hitRadius = 2.5 * b.scaleVal;

                    if (dist < hitRadius) {
                        const died = b.takeDamage(this.isStrong);
                        this.hitList.push(b);
                        if (this.isStrong && !b.isSuper) {
                            // Atravessa
                        } else {
                            this.life = -1;
                            return true;
                        }
                    }
                }
            }
        }
        this.life--;
        return this.life < 0;
    }
}

// ==========================================
// 4. SETUP E MAIN LOOP
// ==========================================
async function main() {
    const canvas = document.querySelector('#glCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const gl = canvas.getContext('webgl2', { powerPreference: "high-performance" });
    if (!gl) return alert("WebGL2 necessário!");
    
    // Configurações Globais
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Função para criar programas de shader
    const createProgram = (gl, vs, fs) => {
        const s = (t, src) => {
            const sh = gl.createShader(t);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
            return sh;
        };
        const p = gl.createProgram();
        gl.attachShader(p, s(gl.VERTEX_SHADER, vs));
        gl.attachShader(p, s(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(p);
        return p;
    };

    const shadowProg = createProgram(gl, shadowVsSource, shadowFsSource);
    const mainProg = createProgram(gl, vsSource, fsSource);

    // --- CARREGAMENTO DE MODELOS E TEXTURAS ---
    
    // 1. Carregar MTL da Árvore
    const treeMaterials = await loadMTL('tree.mtl');
    const treeTextures = {};
    for(let matName in treeMaterials) {
        if(treeMaterials[matName].map) {
            treeTextures[matName] = loadTexture(gl, treeMaterials[matName].map);
        }
    }

    // 2. Carregar Modelos
    // Árvore: Loader complexo (lista de grupos)
    const treeGroups = await loadComplexOBJ('tree.obj'); 
    
    // Arma e Inimigo: Loader simples (peça única)
    const cannonData = await loadSimpleOBJ('cannon.obj');
    const bolsonaroData = await loadSimpleOBJ('bolsonaro.obj');
    
    const wallData = createCubeData(); 
    const floorData = createFloorData(100);
    const sphereData = createSphereData(0.2); 
    const sunData = createSphereData(5.0);

    // 3. Texturas Gerais
    const grassTex = loadTexture(gl, 'grass.jpg');
    const treeTexDefault = loadTexture(gl, 'tree.jpg'); // Fallback
    const wallTex = loadTexture(gl, 'wall.png'); 
    const bolsonaroTex = loadTexture(gl, 'bolsonaro.jpg');
    const cannonTex = loadTexture(gl, 'cannon.png');

    const shadowFBO = createShadowFramebuffer(gl, 1024);
    
    // Mapeamento de Uniforms
    const getUniforms = (gl, p) => ({ 
        proj: gl.getUniformLocation(p, "uProj"), view: gl.getUniformLocation(p, "uView"), model: gl.getUniformLocation(p, "uModel"),
        normMat: gl.getUniformLocation(p, "uNormMat"), lightPos: gl.getUniformLocation(p, "uLightPos"),
        viewPos: gl.getUniformLocation(p, "uViewPos"), lightCol: gl.getUniformLocation(p, "uLightCol"),
        objCol: gl.getUniformLocation(p, "uObjCol"), flash: gl.getUniformLocation(p, "uFlash"),
        sampler: gl.getUniformLocation(p, "uSampler"), useTex: gl.getUniformLocation(p, "uUseTex"), 
        uTexScale: gl.getUniformLocation(p, "uTexScale"), lightSpaceMatrix: gl.getUniformLocation(p, "uLightSpaceMatrix"),
        shadowMap: gl.getUniformLocation(p, "uShadowMap"), isSun: gl.getUniformLocation(p, "uIsSun")
    });

    const uShadow = { model: gl.getUniformLocation(shadowProg, 'uModel'), lightSpace: gl.getUniformLocation(shadowProg, 'uLightSpaceMatrix') };
    const uMain = getUniforms(gl, mainProg);
    
    // Função para criar VAO
    const createVAO = (gl, data) => {
        if(!data || data.length === 0) return null;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        // Layout: 3 pos, 2 tex, 3 norm = 8 floats (32 bytes)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20); gl.enableVertexAttribArray(2);
        return vao;
    };

    // Criar VAOs
    const vaoCannon = createVAO(gl, cannonData);
    const vaoWall = createVAO(gl, wallData);
    const vaoFloor = createVAO(gl, floorData);
    const vaoSphere = createVAO(gl, sphereData);
    const vaoSun = createVAO(gl, sunData);
    const vaoBolsonaro = createVAO(gl, bolsonaroData);
    
    // VAOs da Árvore (Múltiplos)
    treeGroups.forEach(g => { g.vao = createVAO(gl, g.data); });

    // Estado do Jogo
    const cam = { pos: vec3.fromValues(0, 1.7, 0), yaw: -90, pitch: 0, front: [0,0,-1], velY: 0, grounded: true, recoil: 0, flash: 0 };
    const keys = {};
    const projectiles = [];
    const enemies = [];
    const trees = Array.from({length: 30}, () => ({ x: (Math.random()-0.5)*80, z: (Math.random()-0.5)*80 }));
    
    const walls = [
        { pos: [0, 3, -50.5], scale: [100, 6, 1], uv: [20, 1] }, 
        { pos: [0, 3, 50.5],  scale: [100, 6, 1], uv: [20, 1] }, 
        { pos: [50.5, 3, 0],  scale: [1, 6, 100], uv: [20, 1] }, 
        { pos: [-50.5, 3, 0], scale: [1, 6, 100], uv: [20, 1] } 
    ];

    let sunAngle = 0.5;
    let isCharging = false;
    let chargeStartTime = 0;
    const powerBar = document.getElementById('power-bar');
    const powerContainer = document.getElementById('power-container');

    // Input Handlers
    window.onkeydown = e => { keys[e.key.toLowerCase()] = true; if(e.code==='Space'&&cam.grounded){cam.velY=0.2; cam.grounded=false;} };
    window.onkeyup = e => keys[e.key.toLowerCase()] = false;
    
    canvas.onmousedown = () => { 
        canvas.requestPointerLock(); 
        isCharging = true; 
        chargeStartTime = performance.now(); 
        powerContainer.style.display = 'block'; 
    };
    
    canvas.onmouseup = () => {
        if(isCharging) {
            isCharging = false; 
            powerContainer.style.display = 'none'; 
            powerBar.style.width = '0%';
            
            const duration = (performance.now() - chargeStartTime) / 1000;
            const speed = Math.min(3.0, 0.5 + (duration * 2.5));
            cam.recoil = 0.6; 
            cam.flash = 0.5 + (speed * 0.2);
            
            // Spawn Tiro (Offset da Arma)
            const spawnPos = vec3.create(); vec3.copy(spawnPos, cam.pos);
            const right = vec3.create(); vec3.cross(right, cam.front, [0,1,0]);
            const down = vec3.create(); vec3.scale(down, [0,1,0], -1);
            
            vec3.scaleAndAdd(spawnPos, spawnPos, right, 0.2);  
            vec3.scaleAndAdd(spawnPos, spawnPos, down, 0.2);
            vec3.scaleAndAdd(spawnPos, spawnPos, cam.front, 0.5);

            projectiles.push(new Projectile(spawnPos, cam.front, speed));
        }
    };
    
    window.onmousemove = e => { 
        if(document.pointerLockElement === canvas) { 
            cam.yaw += e.movementX * 0.1; 
            cam.pitch = Math.max(-85, Math.min(85, cam.pitch - e.movementY * 0.1)); 
        }
    };

    function updatePhysics() {
        cam.velY -= 0.01; cam.pos[1] += cam.velY;
        if(cam.pos[1] < 1.7) { cam.pos[1]=1.7; cam.velY=0; cam.grounded=true; }
        
        const f = [
            Math.cos(cam.pitch*0.0174)*Math.cos(cam.yaw*0.0174), 
            Math.sin(cam.pitch*0.0174), 
            Math.cos(cam.pitch*0.0174)*Math.sin(cam.yaw*0.0174)
        ];
        vec3.normalize(cam.front, f);
        
        const walkF = vec3.fromValues(cam.front[0], 0, cam.front[2]); vec3.normalize(walkF, walkF);
        const side = vec3.create(); vec3.cross(side, walkF, [0,1,0]);
        
        let m = vec3.create();
        if(keys.w) vec3.scaleAndAdd(m, m, walkF, 0.15); 
        if(keys.s) vec3.scaleAndAdd(m, m, walkF, -0.15);
        if(keys.a) vec3.scaleAndAdd(m, m, side, -0.15); 
        if(keys.d) vec3.scaleAndAdd(m, m, side, 0.15);
        
        const nP = vec3.create(); vec3.add(nP, cam.pos, m);
        
        // Limites do mapa
        const limit = 48.5; 
        if(nP[0] > limit) nP[0] = limit; if(nP[0] < -limit) nP[0] = -limit;
        if(nP[2] > limit) nP[2] = limit; if(nP[2] < -limit) nP[2] = -limit;
        
        // Colisão Árvores Simples
        if(!trees.some(t => Math.hypot(nP[0]-t.x, nP[2]-t.z) < 1.0)) { 
            cam.pos[0]=nP[0]; cam.pos[2]=nP[2]; 
        }
    }

    function drawScene(shader, uniforms, isShadowPass) {
        let m = mat4.create();
        
        // CHÃO
        mat4.identity(m); gl.uniformMatrix4fv(uniforms.model, false, m);
        if(!isShadowPass) {
            gl.uniform3fv(uniforms.objCol, [1,1,1]); gl.uniform1i(uniforms.useTex, 1);
            gl.uniform2f(uniforms.uTexScale, 50.0, 50.0); gl.uniform1i(uniforms.isSun, 0);
            const nm = mat3.create(); mat3.normalFromMat4(nm, m);
            gl.uniformMatrix3fv(uniforms.normMat, false, nm); gl.bindTexture(gl.TEXTURE_2D, grassTex);
        }
        gl.bindVertexArray(vaoFloor); gl.drawArrays(gl.TRIANGLES, 0, 6);

        // PAREDES
        if(!isShadowPass) { gl.uniform1i(uniforms.useTex, 1); gl.bindTexture(gl.TEXTURE_2D, wallTex); }
        walls.forEach(w => {
            mat4.identity(m); mat4.translate(m, m, w.pos); mat4.scale(m, m, w.scale);
            gl.uniformMatrix4fv(uniforms.model, false, m);
            if(!isShadowPass) {
                gl.uniform2f(uniforms.uTexScale, w.uv[0], w.uv[1]);
                const nm = mat3.create(); mat3.normalFromMat4(nm, m);
                gl.uniformMatrix3fv(uniforms.normMat, false, nm);
            }
            gl.bindVertexArray(vaoWall); gl.drawArrays(gl.TRIANGLES, 0, 36);
        });

        // ÁRVORES (DESENHO MULTI-MATERIAL COM ROTAÇÃO CORRIGIDA)
        if(!isShadowPass) { gl.uniform2f(uniforms.uTexScale, 1.0, 1.0); }
        trees.forEach(t => {
            mat4.identity(m); 
            mat4.translate(m, m, [t.x, 0, t.z]); 
            
            // CORREÇÃO: GIRA A ÁRVORE 90 GRAUS (Se o OBJ vier deitado)
            mat4.rotateX(m, m, -Math.PI / 2); 
            
            mat4.scale(m, m, [5.0, 5.0, 5.0]); // Escala da árvore
            
            gl.uniformMatrix4fv(uniforms.model, false, m);
            if(!isShadowPass) {
                const nm = mat3.create(); mat3.normalFromMat4(nm, m);
                gl.uniformMatrix3fv(uniforms.normMat, false, nm);
            }

            // Loop pelos grupos da árvore (Tronco, Folhas...)
            treeGroups.forEach(group => {
                if(!isShadowPass) {
                    // Tenta achar a textura certa para este grupo no MTL
                    const tex = treeTextures[group.material] || treeTexDefault;
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                }
                gl.bindVertexArray(group.vao);
                gl.drawArrays(gl.TRIANGLES, 0, group.count);
            });
        });

        // PROJÉTEIS
        if(!isShadowPass) { gl.uniform1i(uniforms.useTex, 0); }
        projectiles.forEach(p => {
            mat4.identity(m); mat4.translate(m, m, p.pos);
            gl.uniformMatrix4fv(uniforms.model, false, m);
            if(!isShadowPass) {
                gl.uniform3fv(uniforms.objCol, p.color);
                const nm = mat3.create(); mat3.normalFromMat4(nm, m);
                gl.uniformMatrix3fv(uniforms.normMat, false, nm);
            }
            gl.bindVertexArray(vaoSphere); gl.drawArrays(gl.TRIANGLES, 0, sphereData.length/8);
        });

        // INIMIGOS (BOLSONARO)
        if(!isShadowPass) {
            gl.uniform1i(uniforms.useTex, 1);
            gl.uniform3fv(uniforms.objCol, [1,1,1]);
            gl.bindTexture(gl.TEXTURE_2D, bolsonaroTex);
        }
        enemies.forEach(b => {
            if(!b.alive) return;
            mat4.identity(m); mat4.translate(m, m, b.pos);
            const dx = cam.pos[0] - b.pos[0]; const dz = cam.pos[2] - b.pos[2];
            mat4.rotateY(m, m, Math.atan2(dx, dz));
            
            // Escala original (não normalizada)
            const s = b.scaleVal * 1.8; 
            mat4.scale(m, m, [s, s, s]); 
            
            gl.uniformMatrix4fv(uniforms.model, false, m);
            if(!isShadowPass) {
                gl.uniform3fv(uniforms.objCol, b.color);
                const nm = mat3.create(); mat3.normalFromMat4(nm, m);
                gl.uniformMatrix3fv(uniforms.normMat, false, nm);
            }
            gl.bindVertexArray(vaoBolsonaro); 
            // Fallback: Se não carregou, usa cubo
            const vCount = (bolsonaroData.length > 36) ? bolsonaroData.length/8 : 36;
            gl.drawArrays(gl.TRIANGLES, 0, vCount);
        });

        // --- ARMA (HUD FIXO NO CANTO) ---
        if(!isShadowPass) {
            gl.disable(gl.DEPTH_TEST); 
            gl.uniform1i(uMain.isSun, 0);

            const hudView = mat4.create(); 
            gl.uniformMatrix4fv(uMain.view, false, hudView);

            let mGun = mat4.create();
            // Posição HUD
            const zRecoil = -0.6 + (cam.recoil * 0.2); 
            const yRecoil = -0.4 + (cam.recoil * 0.05);
            mat4.translate(mGun, mGun, [0.25, yRecoil, zRecoil]); 
            
            // Rotação
            mat4.rotateY(mGun, mGun, Math.PI); 
            mat4.rotateX(mGun, mGun, 0.05 + (cam.recoil * 0.5));
            
            // Escala
            mat4.scale(mGun, mGun, [0.2, 0.2, 0.2]);

            gl.uniformMatrix4fv(uMain.model, false, mGun);
            const nm = mat3.create(); mat3.normalFromMat4(nm, mGun);
            gl.uniformMatrix3fv(uMain.normMat, false, nm);

            gl.uniform3fv(uMain.objCol, [1, 1, 1]);
            gl.uniform1i(uMain.useTex, 1);
            gl.bindTexture(gl.TEXTURE_2D, cannonTex);

            gl.bindVertexArray(vaoCannon);
            const vCountGun = (cannonData.length > 36) ? cannonData.length/8 : 36;
            gl.drawArrays(gl.TRIANGLES, 0, vCountGun);
            
            gl.enable(gl.DEPTH_TEST);
        }
    }

    function render(now) {
        now *= 0.001;
        updatePhysics();
        cam.recoil = Math.max(0, cam.recoil * 0.85); 
        cam.flash *= 0.8;

        if(Math.random() < 0.01) {
            const spawnSuper = (gameScore >= 100) && (Math.random() < 0.1);
            enemies.push(new Bolsonaro(spawnSuper));
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
            if (!enemies[i].alive) enemies.splice(i, 1); else enemies[i].update(cam.pos);
        }
        if(isCharging) {
            const pct = Math.min(1.0, (performance.now() - chargeStartTime) / 1000) * 100; 
            powerBar.style.width = `${pct}%`;
        }
        for(let i = projectiles.length - 1; i >= 0; i--) {
            if(projectiles[i].update(trees, walls, enemies)) projectiles.splice(i, 1);
        }

        sunAngle += 0.0005;
        const lightPos = vec3.fromValues(Math.sin(sunAngle) * 150, 100, Math.cos(sunAngle) * 150);
        const lightProj = mat4.create(); mat4.ortho(lightProj, -120, 120, -120, 120, 1.0, 400.0); 
        const lightView = mat4.create(); mat4.lookAt(lightView, lightPos, [0,0,0], [0,1,0]);
        const lightSpaceMatrix = mat4.create(); mat4.multiply(lightSpaceMatrix, lightProj, lightView);

        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO.fbo); gl.viewport(0, 0, shadowFBO.size, shadowFBO.size);
        gl.clear(gl.DEPTH_BUFFER_BIT); gl.useProgram(shadowProg);
        gl.uniformMatrix4fv(uShadow.lightSpace, false, lightSpaceMatrix);
        drawScene(shadowProg, uShadow, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0.5, 0.7, 0.9, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(mainProg);
        
        const proj = mat4.create(); mat4.perspective(proj, 60*Math.PI/180, canvas.width/canvas.height, 0.1, 300);
        const view = mat4.create(); const tar = vec3.create(); vec3.add(tar, cam.pos, cam.front);
        mat4.lookAt(view, cam.pos, tar, [0,1,0]);

        gl.uniformMatrix4fv(uMain.proj, false, proj); gl.uniformMatrix4fv(uMain.view, false, view);
        gl.uniform3fv(uMain.viewPos, cam.pos); gl.uniform3fv(uMain.lightPos, lightPos);
        gl.uniform3fv(uMain.lightCol, [1.0, 0.95, 0.8]); gl.uniform1f(uMain.flash, cam.flash);
        gl.uniformMatrix4fv(uMain.lightSpaceMatrix, false, lightSpaceMatrix);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowFBO.depthMap);
        gl.uniform1i(uMain.shadowMap, 1); gl.activeTexture(gl.TEXTURE0);

        drawScene(mainProg, uMain, false);

        gl.uniform2f(uMain.uTexScale, 1.0, 1.0); 
        let mSun = mat4.create(); mat4.translate(mSun, mSun, lightPos);
        gl.uniformMatrix4fv(uMain.model, false, mSun); gl.uniform1i(uMain.isSun, 1);
        gl.bindVertexArray(vaoSun); gl.drawArrays(gl.TRIANGLES, 0, sunData.length/8);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

// Helper Framebuffer Sombra
function createShadowFramebuffer(gl, size) {
    const depthMap = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, depthMap);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthMap, 0);
    gl.drawBuffers([]); gl.readBuffer(gl.NONE); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, depthMap, size };
}

main();