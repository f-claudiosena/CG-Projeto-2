import { mat4, vec3, mat3, vec4 } from 'https://cdn.skypack.dev/gl-matrix';
import { loadOBJ as loadComplexOBJ } from './obj-loader.js';

// ==========================================
// 1. SISTEMA DE SCORE (LOCALSTORAGE)
// ==========================================

function loadHighScores() {
    const scores = JSON.parse(localStorage.getItem('patriota_scores') || '[]');
    const list = document.getElementById('high-scores-list');
    if (list) {
        if (scores.length === 0) {
            list.innerHTML = '<li>---</li>';
        } else {
            list.innerHTML = scores.map((s, i) => `<li>${i + 1}º - ${s} pts</li>`).join('');
        }
    }
}

function saveHighScore(newScore) {
    if (newScore === 0) return;
    let scores = JSON.parse(localStorage.getItem('patriota_scores') || '[]');
    scores.push(newScore);
    scores.sort((a, b) => b - a); 
    scores = scores.slice(0, 5); 
    localStorage.setItem('patriota_scores', JSON.stringify(scores));
    loadHighScores();
}

// ==========================================
// 2. UTILITÁRIOS (Helpers)
// ==========================================

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
                materials[currentMaterial] = { map: null, Kd: [1,1,1] };
            } else if (currentMaterial) {
                if (parts[0] === 'map_Kd') {
                    // Pega só o nome do arquivo, ignora caminhos C:\...
                    materials[currentMaterial].map = parts[parts.length-1].split(/[\\/]/).pop(); 
                } else if (parts[0] === 'Kd') {
                    materials[currentMaterial].Kd = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
                }
            }
        });
        return materials;
    } catch (e) {
        console.warn("MTL não encontrado ou erro:", e);
        return {};
    }
}

function loadTexture(gl, url) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Placeholder cinza
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128,128,128,255]));
    
    const img = new Image();
    const noCacheUrl = url; 
    
    img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        // Filtro Trilinear (Melhor qualidade)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    img.onerror = () => console.warn(`Textura falhou: ${url}`);
    img.src = noCacheUrl;
    return tex;
}

// NOVO: Loader de Cubemap seguro (não trava se faltar imagem)
function loadCubemap(gl, urls) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);

    const targets = [
        gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
    ];

    // 1. Cria faces padrão (Degradê Azul) imediatamente
    targets.forEach(target => {
        const level = 0, internalFormat = gl.RGBA, width = 2, height = 2, border = 0, format = gl.RGBA, type = gl.UNSIGNED_BYTE;
        const data = new Uint8Array([
            60, 100, 180, 255,  60, 100, 180, 255, // Topo azulado
            20,  40,  90, 255,  20,  40,  90, 255  // Base escura
        ]);
        gl.texImage2D(target, level, internalFormat, width, height, border, format, type, data);
    });
    
    // Configuração inicial segura (sem mipmap ainda)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    let loadCount = 0;
    let hasError = false;

    urls.forEach((url, i) => {
        const img = new Image();
        img.onload = () => {
            if(hasError) return; // Se um falhou, mantemos o fallback
            gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
            gl.texImage2D(targets[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            loadCount++;
            // Só gera mipmap quando TODAS carregarem
            if (loadCount === 6) {
                gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
                gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            }
        };
        img.onerror = () => { hasError = true; console.warn("Skybox incompleto, usando fallback."); };
        img.src = url;
    });

    return texture;
}

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
        console.warn(`Fallback para cubo: ${url} falhou.`);
        return createCubeData(); 
    }
}

function createCubeData() {
    const v = [
        -0.5, -0.5,  0.5, 0,0, 0,0,1,  0.5, -0.5,  0.5, 1,0, 0,0,1,  0.5,  0.5,  0.5, 1,1, 0,0,1,
        -0.5, -0.5,  0.5, 0,0, 0,0,1,  0.5,  0.5,  0.5, 1,1, 0,0,1, -0.5,  0.5,  0.5, 0,1, 0,0,1,
        -0.5, -0.5, -0.5, 0,0, 0,0,-1, -0.5,  0.5, -0.5, 0,1, 0,0,-1,  0.5,  0.5, -0.5, 1,1, 0,0,-1,
        -0.5, -0.5, -0.5, 0,0, 0,0,-1,  0.5,  0.5, -0.5, 1,1, 0,0,-1,  0.5, -0.5, -0.5, 1,0, 0,0,-1,
        -0.5,  0.5, -0.5, 0,1, 0,1,0,  -0.5,  0.5,  0.5, 0,0, 0,1,0,   0.5,  0.5,  0.5, 1,0, 0,1,0,
        -0.5,  0.5, -0.5, 0,1, 0,1,0,   0.5,  0.5,  0.5, 1,0, 0,1,0,   0.5,  0.5, -0.5, 1,1, 0,1,0,
        -0.5, -0.5, -0.5, 0,1, 0,-1,0,  0.5, -0.5, -0.5, 1,1, 0,-1,0,  0.5, -0.5,  0.5, 1,0, 0,-1,0,
        -0.5, -0.5, -0.5, 0,1, 0,-1,0,  0.5, -0.5,  0.5, 1,0, 0,-1,0, -0.5, -0.5,  0.5, 0,0, 0,-1,0,
         0.5, -0.5, -0.5, 0,0, 1,0,0,   0.5,  0.5, -0.5, 0,1, 1,0,0,   0.5,  0.5,  0.5, 1,1, 1,0,0,
         0.5, -0.5, -0.5, 0,0, 1,0,0,   0.5,  0.5,  0.5, 1,1, 1,0,0,   0.5, -0.5,  0.5, 1,0, 1,0,0,
        -0.5, -0.5, -0.5, 0,0, -1,0,0, -0.5, -0.5,  0.5, 1,0, -1,0,0, -0.5,  0.5,  0.5, 1,1, -1,0,0,
        -0.5, -0.5, -0.5, 0,0, -1,0,0, -0.5,  0.5,  0.5, 1,1, -1,0,0, -0.5,  0.5, -0.5, 0,1, -1,0,0
    ];
    return new Float32Array(v);
}

// CORREÇÃO: Função createSphereData trazida de volta
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

// Esfera High Poly para Sol e Lua
function createHighPolySphere(radius) {
    const lat = 40, lon = 40;
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
                add(theta, phi); add((i + 1) * Math.PI / lat, phi); add(theta, (j + 1) * 2 * Math.PI / lon);
                add((i + 1) * Math.PI / lat, phi); add((i + 1) * Math.PI / lat, (j + 1) * 2 * Math.PI / lon); add(theta, (j + 1) * 2 * Math.PI / lon);
            }
        }
    }
    return new Float32Array(v);
}

function createFloorData(size) {
    const s = size / 2;
    return new Float32Array([
        -s, 0, s, 0, 0, 0, 1, 0, s, 0, s, 1, 0, 0, 1, 0, -s, 0, -s, 0, 1, 0, 1, 0, 
        -s, 0, -s, 0, 1, 0, 1, 0, s, 0, s, 1, 0, 0, 1, 0, s, 0, -s, 1, 1, 0, 1, 0
    ]);
}

// ==========================================
// 3. SHADERS (CÓDIGO GLSL ATUALIZADO)
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
precision highp float;

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
    
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(textureSize(uShadowMap, 0));
    for(int x = -1; x <= 1; ++x) {
        for(int y = -1; y <= 1; ++y) {
            float pcfDepth = texture(uShadowMap, projCoords.xy + vec2(x, y) * texelSize).r; 
            shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;        
        }    
    }
    shadow /= 9.0;
    
    return shadow;
}

void main() {
    // Modo Emissivo (Sol/Lua) - Cor Pura
    if(uIsSun) { 
        fCol = vec4(uObjCol, 1.0); 
        return; 
    }

    vec3 color = uObjCol;
    if(uUseTex) {
        vec4 texColor = texture(uSampler, vTex);
        if(texColor.a < 0.1) discard; 
        color = texColor.rgb * uObjCol; 
    }

    // Phong Shading Completo
    vec3 normal = normalize(vNorm);
    vec3 lightDir = normalize(uLightPos - vPos);
    vec3 viewDir = normalize(uViewPos - vPos);

    vec3 ambient = 0.3 * color;

    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diff * uLightCol * color;

    float specularStrength = 0.5;
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    vec3 specular = specularStrength * spec * uLightCol;

    float shadowIntensity = 1.0;
    float shadow = ShadowCalculation(vPosLightSpace, normal, lightDir);
    
    vec3 lighting = (ambient + (1.0 - (shadow * shadowIntensity)) * (diffuse + specular)) + (uFlash * color);
    fCol = vec4(lighting, 1.0);
}`;

// --- SHADERS DO SKYBOX ---
const skyboxVs = `#version 300 es
layout(location=0) in vec3 aPos;
out vec3 vTexCoords;
uniform mat4 uProj;
uniform mat4 uView;
void main() {
    vTexCoords = aPos;
    vec4 pos = uProj * uView * vec4(aPos, 1.0);
    gl_Position = pos.xyww; // Z=1 para ficar sempre no fundo
}`;

const skyboxFs = `#version 300 es
precision mediump float;
in vec3 vTexCoords;
uniform samplerCube uSkybox;
uniform vec3 uTint; // Tinta para escurecer a noite
out vec4 fCol;
void main() {
    vec4 tex = texture(uSkybox, vTexCoords);
    fCol = vec4(tex.rgb * uTint, 1.0);
}`;


// ==========================================
// 4. LÓGICA DO JOGO (CLASSES)
// ==========================================

let gameScore = 0;
let playerHealth = 2; 
const scoreElement = document.getElementById('score-board');

function updateUI() {
    if (scoreElement) {
        let hearts = "";
        for(let i=0; i<playerHealth; i++) hearts += "❤️";
        scoreElement.innerText = `PONTOS: ${gameScore} | VIDA: ${hearts}`;
    }
}

class Heart {
    constructor(pos) {
        if (pos) {
            this.pos = vec3.clone(pos);
            this.pos[1] = 1.0; 
        } else {
            const x = (Math.random() - 0.5) * 80;
            const z = (Math.random() - 0.5) * 80;
            this.pos = vec3.fromValues(x, 1.5, z);
        }
        
        this.alive = true;
        this.angle = 0;
        this.baseY = this.pos[1];
        this.color = [1.0, 0.0, 0.0]; 
    }

    update(playerPos) {
        if(!this.alive) return;

        this.angle += 0.05;
        this.pos[1] = this.baseY + Math.sin(Date.now() * 0.003) * 0.3;

        const dist = vec3.distance(this.pos, playerPos);
        if(dist < 1.5) {
            if (playerHealth < 5) { 
                playerHealth++;
                updateUI();
            }
            this.alive = false;
        }
    }
}

class Bolsonaro {
    constructor(type = 'NORMAL') {
        const side = Math.floor(Math.random() * 4);
        const dist = 65;
        const offset = (Math.random() - 0.5) * 80;

        if (side === 0) this.pos = vec3.fromValues(offset, 0, -dist);
        else if (side === 1) this.pos = vec3.fromValues(offset, 0, dist);
        else if (side === 2) this.pos = vec3.fromValues(dist, 0, offset);
        else this.pos = vec3.fromValues(-dist, 0, offset);

        this.type = type;

        if (this.type === 'SUPER') {
            this.hp = 2;
            this.scaleVal = 1.5; 
            this.color = [1.0, 0.5, 0.5];
            this.speed = 0.025 + Math.random() * 0.01;
            this.audioFile = 'ninguem-pega-meu-telefone.mp3';
            this.deathSound = 'pegaram-meu-telefone.mp3';
            this.points = 50;
        } 
        else if (this.type === 'MINI') {
            this.hp = 3; 
            this.scaleVal = 0.4;
            this.color = [0.2, 1.0, 0.2];
            this.speed = 0.06 + Math.random() * 0.02;
            this.audioFile = 'bolsonaro-problema-o-tempo-todo.mp3';
            this.deathSound = 'canalhas-canalhas.mp3';
            this.points = 100;
        }
        else { // NORMAL
            this.hp = 1;
            this.scaleVal = 0.6; 
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
        
        if(distToPlayer < 2.5) {
            if (this.type === 'SUPER' || this.type === 'MINI') {
                this.alive = false; 
                this.audio.pause();
                return "HIT_PLAYER";
            } 
        }

        dir[1] = 0;
        this.angle = Math.atan2(dir[0], dir[2]);
        vec3.normalize(dir, dir);
        vec3.scaleAndAdd(this.pos, this.pos, dir, this.speed);

        const jumpHeight = (this.type === 'SUPER') ? 0.3 : 0.1;
        const baseHeight = (this.type === 'SUPER') ? 1.5 : 0.8; 
        this.pos[1] = baseHeight + (Math.abs(Math.sin(Date.now() * 0.015)) * jumpHeight);

        if (Date.now() > this.nextTalkTime) {
            this.audio.currentTime = 0;
            this.audio.play().catch(() => {});
            this.nextTalkTime = Date.now() + 3000 + Math.random() * 2000;
        }

        let volume = 1.0 - (distToPlayer / 50.0);
        if (volume < 0) volume = 0;
        if (volume > 1) volume = 1;
        this.audio.volume = volume;

        return "OK";
    }

    takeDamage(isStrongShot) {
        if (this.type === 'SUPER') {
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
        gameScore += this.points;
        updateUI();
        
        if (Math.random() < 0.10) {
            return "DROP_HEART";
        }
        return null;
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

        for (let b of enemies) {
            if (b.alive) {
                if (!this.hitList.includes(b)) {
                    const dx = this.pos[0] - b.pos[0];
                    const dz = this.pos[2] - b.pos[2];
                    const distXZ = Math.hypot(dx, dz);
                    const dy = this.pos[1] - b.pos[1]; 
                    
                    let hitMult = 4.0;
                    if (b.type === 'NORMAL') hitMult = 5.5; 

                    const hitRadius = hitMult * b.scaleVal; 
                    const headHeight = b.scaleVal * 5.5; 

                    if (distXZ < hitRadius && dy > -0.5 && dy < headHeight) {
                        const died = b.takeDamage(this.isStrong);
                        this.hitList.push(b);
                        if (this.isStrong && b.type !== 'SUPER') {
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
// 5. SETUP E MAIN LOOP
// ==========================================

const uiLayer = document.getElementById('ui-layer');
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameOverScreen = document.getElementById('gameover-screen');
const finalScoreDisplay = document.getElementById('final-score');
const btnStart = document.getElementById('btn-start');
const btnResume = document.getElementById('btn-resume');
const btnMenu = document.getElementById('btn-menu');
const btnRestart = document.getElementById('btn-restart');
const btnMenuOver = document.getElementById('btn-menu-over');
const canvas = document.querySelector('#glCanvas');

let gameState = 'MENU'; 
let cam, keys = {}, projectiles = [], enemies = [], hearts = [], trees = [], walls = [];
let resetGameFunc = null; 

async function init() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const gl = canvas.getContext('webgl2', { powerPreference: "high-performance" });
    if (!gl) return alert("WebGL2 necessário!");
    
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    loadHighScores();

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
    // NOVO: Programa do Skybox
    const skyboxProg = createProgram(gl, skyboxVs, skyboxFs);

    const treeMaterials = await loadMTL('tree.mtl');
    const treeTextures = {};
    for(let matName in treeMaterials) {
        if(treeMaterials[matName].map) {
            treeTextures[matName] = loadTexture(gl, treeMaterials[matName].map);
        }
    }

    const treeGroups = await loadComplexOBJ('tree.obj'); 
    const cannonData = await loadSimpleOBJ('cannon.obj');
    const bolsonaroData = await loadSimpleOBJ('bolsonaro.obj');
    const heartData = await loadSimpleOBJ('heart.obj');
    const celestialData = createHighPolySphere(1.0);  

    // NOVO: Carregar material da faca
    const knifeMaterials = await loadMTL('cannon.mtl');
    let knifeTex = null;
    let knifeColor = [0.6, 0.6, 0.6]; // Cor padrão se falhar
    // O nome do material no MTL pode variar (ex: "None" ou "Material"), pegamos o primeiro
    const matKey = Object.keys(knifeMaterials)[0];
    if (matKey && knifeMaterials[matKey]) {
        if (knifeMaterials[matKey].Kd) knifeColor = knifeMaterials[matKey].Kd;
        if (knifeMaterials[matKey].map) knifeTex = loadTexture(gl, knifeMaterials[matKey].map);
    }

    const wallData = createCubeData(); 
    const floorData = createFloorData(100);
    const sphereData = createSphereData(0.2); 
    
    // NOVO: Textura do Skybox
    const skyboxTex = loadCubemap(gl, [
        'sky_right.jpg', 'sky_left.jpg', 'sky_top.jpg', 'sky_bottom.jpg', 'sky_front.jpg', 'sky_back.jpg'
    ]);

    const grassTex = loadTexture(gl, 'grass.jpg');
    const treeTexDefault = loadTexture(gl, 'tree.jpg');
    const wallTex = loadTexture(gl, 'wall.png'); 
    const bolsonaroTex = loadTexture(gl, 'bolsonaro.jpg');

    const shadowFBO = createShadowFramebuffer(gl, 2048); 
    
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
    const uSkybox = {
        proj: gl.getUniformLocation(skyboxProg, "uProj"),
        view: gl.getUniformLocation(skyboxProg, "uView"),
        tint: gl.getUniformLocation(skyboxProg, "uTint")
    };
    
    const createVAO = (gl, data) => {
        if(!data || data.length === 0) return null;
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 20); gl.enableVertexAttribArray(2);
        return vao;
    };

    const vaoCannon = createVAO(gl, cannonData);
    const vaoWall = createVAO(gl, wallData);
    const vaoFloor = createVAO(gl, floorData);
    const vaoSphere = createVAO(gl, sphereData);
    
    const vaoCelestial = createVAO(gl, celestialData); 
    const vaoBolsonaro = createVAO(gl, bolsonaroData);
    const vaoHeart = createVAO(gl, heartData);
    
    const vaoCube = createVAO(gl, createCubeData()); // Para o Skybox

    treeGroups.forEach(g => { g.vao = createVAO(gl, g.data); });

    resetGameFunc = () => {
        cam = { pos: vec3.fromValues(0, 1.7, 0), yaw: -90, pitch: 0, front: [0,0,-1], velY: 0, grounded: true, recoil: 0, flash: 0 };
        keys = {};
        projectiles = [];
        enemies = [];
        hearts = [];
        trees = Array.from({length: 30}, () => ({ x: (Math.random()-0.5)*80, z: (Math.random()-0.5)*80 }));
        walls = [
            { pos: [0, 3, -50.5], scale: [100, 6, 1], uv: [20, 1] }, 
            { pos: [0, 3, 50.5],  scale: [100, 6, 1], uv: [20, 1] }, 
            { pos: [50.5, 3, 0],  scale: [1, 6, 100], uv: [20, 1] }, 
            { pos: [-50.5, 3, 0], scale: [1, 6, 100], uv: [20, 1] } 
        ];
        gameScore = 0;
        playerHealth = 2; 
        updateUI();
    };

    resetGameFunc();

    let isCharging = false;
    let chargeStartTime = 0;
    const powerBar = document.getElementById('power-bar');
    const powerContainer = document.getElementById('power-container');

    const doStart = () => { resetGameFunc(); gameState = 'PLAYING'; startScreen.classList.add('hidden'); uiLayer.style.display = 'block'; canvas.requestPointerLock(); };
    const doPause = () => { if(gameState==='GAMEOVER')return; gameState='PAUSED'; pauseScreen.classList.remove('hidden'); uiLayer.style.display='none'; document.exitPointerLock(); };
    const doResume = () => { gameState='PLAYING'; pauseScreen.classList.add('hidden'); uiLayer.style.display='block'; canvas.requestPointerLock(); };
    
    const doGameOver = () => { 
        gameState='GAMEOVER'; 
        saveHighScore(gameScore); 
        finalScoreDisplay.innerText=`Pontuação: ${gameScore}`; 
        gameOverScreen.classList.remove('hidden'); 
        uiLayer.style.display='none'; 
        document.exitPointerLock(); 
    };
    
    const goMenu = () => { gameState='MENU'; pauseScreen.classList.add('hidden'); gameOverScreen.classList.add('hidden'); startScreen.classList.remove('hidden'); uiLayer.style.display='none'; document.exitPointerLock(); };

    btnStart.onclick = doStart; btnResume.onclick = doResume; btnRestart.onclick = () => { gameOverScreen.classList.add('hidden'); doStart(); }; btnMenu.onclick = goMenu; btnMenuOver.onclick = goMenu;

    window.onkeydown = e => { if(gameState==='PLAYING'){ keys[e.key.toLowerCase()]=true; if(e.code==='Space'&&cam.grounded){cam.velY=0.2;cam.grounded=false;} } };
    window.onkeyup = e => keys[e.key.toLowerCase()] = false;
    document.addEventListener('pointerlockchange', () => { if(document.pointerLockElement!==canvas && gameState==='PLAYING') doPause(); });
    
    canvas.onmousedown = () => { 
        if(gameState!=='PLAYING')return; 
        if(document.pointerLockElement!==canvas){canvas.requestPointerLock();return;} 
        isCharging=true; 
        chargeStartTime=performance.now(); 
        powerContainer.style.display='block'; 
    };
    
    canvas.onmouseup = () => {
        if(gameState!=='PLAYING')return;
        if(isCharging) {
            isCharging=false; 
            powerContainer.style.display='none'; 
            powerBar.style.width='0%';
            
            const duration = (performance.now()-chargeStartTime)/1000;
            const speed = Math.min(3.0, 0.5 + (duration * 2.5));
            cam.recoil = 0.6; 
            cam.flash = 0.5 + (speed * 0.2);
            
            const shotSound = new Audio('gun-fire.mp3');
            shotSound.volume = 0.1;
            
            if (speed >= 2.9) {
                shotSound.playbackRate = 0.6; 
            } else {
                shotSound.playbackRate = 1.0; 
            }

            shotSound.play().catch(()=>{});

            const spawnPos = vec3.create(); vec3.copy(spawnPos, cam.pos);
            const right = vec3.create(); vec3.cross(right, cam.front, [0,1,0]);
            const down = vec3.create(); vec3.scale(down, [0,1,0], -1);
            vec3.scaleAndAdd(spawnPos, spawnPos, right, 0.2); vec3.scaleAndAdd(spawnPos, spawnPos, down, 0.2); vec3.scaleAndAdd(spawnPos, spawnPos, cam.front, 0.5);
            projectiles.push(new Projectile(spawnPos, cam.front, speed));
        }
    };
    window.onmousemove = e => { if(gameState==='PLAYING'&&document.pointerLockElement===canvas){ cam.yaw+=e.movementX*0.1; cam.pitch=Math.max(-85,Math.min(85,cam.pitch-e.movementY*0.1)); } };

    function updatePhysics() {
        if(gameState !== 'PLAYING') return;
        cam.velY -= 0.01; cam.pos[1] += cam.velY;
        if(cam.pos[1] < 1.7) { cam.pos[1]=1.7; cam.velY=0; cam.grounded=true; }
        const f = [Math.cos(cam.pitch*0.0174)*Math.cos(cam.yaw*0.0174), Math.sin(cam.pitch*0.0174), Math.cos(cam.pitch*0.0174)*Math.sin(cam.yaw*0.0174)]; vec3.normalize(cam.front, f);
        const walkF = vec3.fromValues(cam.front[0], 0, cam.front[2]); vec3.normalize(walkF, walkF);
        const side = vec3.create(); vec3.cross(side, walkF, [0,1,0]);
        let m = vec3.create();
        if(keys.w) vec3.scaleAndAdd(m, m, walkF, 0.15); if(keys.s) vec3.scaleAndAdd(m, m, walkF, -0.15);
        if(keys.a) vec3.scaleAndAdd(m, m, side, -0.15); if(keys.d) vec3.scaleAndAdd(m, m, side, 0.15);
        const nP = vec3.create(); vec3.add(nP, cam.pos, m);
        if(nP[0] > 48.5) nP[0]=48.5; if(nP[0] < -48.5) nP[0]=-48.5; if(nP[2] > 48.5) nP[2]=48.5; if(nP[2] < -48.5) nP[2]=-48.5;
        if(!trees.some(t => Math.hypot(nP[0]-t.x, nP[2]-t.z) < 1.0)) { cam.pos[0]=nP[0]; cam.pos[2]=nP[2]; }
    }

    function lerpColor(a, b, t) {
        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t
        ];
    }

    function drawScene(shader, uniforms, isShadowPass, currentLightPos) {
        let m = mat4.create();
        
        mat4.identity(m); gl.uniformMatrix4fv(uniforms.model, false, m);
        if(!isShadowPass) {
            gl.uniform3fv(uniforms.objCol, [1,1,1]); gl.uniform1i(uniforms.useTex, 1);
            gl.uniform2f(uniforms.uTexScale, 50.0, 50.0); gl.uniform1i(uniforms.isSun, 0);
            const nm = mat3.create(); mat3.normalFromMat4(nm, m); gl.uniformMatrix3fv(uniforms.normMat, false, nm); gl.bindTexture(gl.TEXTURE_2D, grassTex);
        }
        gl.bindVertexArray(vaoFloor); gl.drawArrays(gl.TRIANGLES, 0, 6);

        if(!isShadowPass) { gl.uniform1i(uniforms.useTex, 1); gl.bindTexture(gl.TEXTURE_2D, wallTex); }
        walls.forEach(w => {
            mat4.identity(m); mat4.translate(m, m, w.pos); mat4.scale(m, m, w.scale);
            gl.uniformMatrix4fv(uniforms.model, false, m);
            if(!isShadowPass) {
                gl.uniform2f(uniforms.uTexScale, w.uv[0], w.uv[1]);
                const nm = mat3.create(); mat3.normalFromMat4(nm, m); gl.uniformMatrix3fv(uniforms.normMat, false, nm);
            }
            gl.bindVertexArray(vaoWall); gl.drawArrays(gl.TRIANGLES, 0, 36);
        });

        if(!isShadowPass) { gl.uniform2f(uniforms.uTexScale, 1.0, 1.0); }
        trees.forEach(t => {
            mat4.identity(m); mat4.translate(m, m, [t.x, 0, t.z]); mat4.rotateX(m, m, -Math.PI / 2); mat4.scale(m, m, [5.0, 5.0, 5.0]); 
            gl.uniformMatrix4fv(uniforms.model, false, m);
            if(!isShadowPass) { const nm = mat3.create(); mat3.normalFromMat4(nm, m); gl.uniformMatrix3fv(uniforms.normMat, false, nm); }
            treeGroups.forEach(group => {
                if(!isShadowPass) { const tex = treeTextures[group.material] || treeTexDefault; gl.bindTexture(gl.TEXTURE_2D, tex); }
                gl.bindVertexArray(group.vao); gl.drawArrays(gl.TRIANGLES, 0, group.count);
            });
        });

        if(!isShadowPass) { gl.uniform1i(uniforms.useTex, 0); }
        projectiles.forEach(p => {
            mat4.identity(m); mat4.translate(m, m, p.pos);
            gl.uniformMatrix4fv(uniforms.model, false, m);
            if(!isShadowPass) { gl.uniform3fv(uniforms.objCol, p.color); const nm = mat3.create(); mat3.normalFromMat4(nm, m); gl.uniformMatrix3fv(uniforms.normMat, false, nm); }
            gl.bindVertexArray(vaoSphere); gl.drawArrays(gl.TRIANGLES, 0, sphereData.length/8);
        });

        if(!isShadowPass) { gl.uniform1i(uniforms.useTex, 0); }
        hearts.forEach(h => {
            mat4.identity(m); mat4.translate(m, m, h.pos); mat4.rotateY(m, m, h.angle); mat4.scale(m, m, [0.5, 0.5, 0.5]); 
            gl.uniformMatrix4fv(uniforms.model, false, m);
            if(!isShadowPass) { gl.uniform3fv(uniforms.objCol, h.color); const nm = mat3.create(); mat3.normalFromMat4(nm, m); gl.uniformMatrix3fv(uniforms.normMat, false, nm); }
            gl.bindVertexArray(vaoHeart); const vCount = (heartData.length > 36) ? heartData.length/8 : 36; gl.drawArrays(gl.TRIANGLES, 0, vCount);
        });

        if(!isShadowPass) { gl.uniform1i(uniforms.useTex, 1); gl.uniform3fv(uniforms.objCol, [1,1,1]); gl.bindTexture(gl.TEXTURE_2D, bolsonaroTex); }
        enemies.forEach(b => {
            if(!b.alive) return;
            mat4.identity(m); mat4.translate(m, m, b.pos);
            const dx = cam.pos[0] - b.pos[0]; const dz = cam.pos[2] - b.pos[2];
            mat4.rotateY(m, m, Math.atan2(dx, dz));
            const s = b.scaleVal * 1.8; mat4.scale(m, m, [s, s, s]); 
            gl.uniformMatrix4fv(uniforms.model, false, m);
            if(!isShadowPass) { gl.uniform3fv(uniforms.objCol, b.color); const nm = mat3.create(); mat3.normalFromMat4(nm, m); gl.uniformMatrix3fv(uniforms.normMat, false, nm); }
            gl.bindVertexArray(vaoBolsonaro); 
            const vCount = (bolsonaroData.length > 36) ? bolsonaroData.length/8 : 36;
            gl.drawArrays(gl.TRIANGLES, 0, vCount);
        });

        // --- RENDERIZAÇÃO DA FACA (HUD) CORRIGIDA ---
        if(!isShadowPass) {
            gl.disable(gl.DEPTH_TEST); gl.uniform1i(uMain.isSun, 0);
            const hudView = mat4.create(); gl.uniformMatrix4fv(uMain.view, false, hudView);
            
            let mKnife = mat4.create();
            // POSIÇÃO CORRIGIDA: Mão Direita
            mat4.translate(mKnife, mKnife, [0.65, -0.25, -0.6]); 
            const zRecoil = -0.5 + (cam.recoil * 0.1); 
            const yRecoil = -0.15 + (cam.recoil * 0.05); // Mais acima
            
            // X positivo = Direita
            mat4.translate(mKnife, mKnife, [0.4, yRecoil, zRecoil]); 
            
            // Rotação natural da mão
            mat4.rotateY(mKnife, mKnife, Math.PI / 1.05); 
            mat4.rotateX(mKnife, mKnife, 0.1);

            mat4.scale(mKnife, mKnife, [0.04, 0.04, 0.04]); // Escala da faca
            
            gl.uniformMatrix4fv(uMain.model, false, mKnife); 
            const nm = mat3.create(); mat3.normalFromMat4(nm, mKnife); gl.uniformMatrix3fv(uMain.normMat, false, nm);
            
            // APLICA MATERIAL DA FACA (TEXTURA DO MTL)
            if (knifeTex) {
                gl.uniform1i(uMain.useTex, 1);
                gl.bindTexture(gl.TEXTURE_2D, knifeTex);
                gl.uniform3fv(uMain.objCol, [1,1,1]); // Cor branca para multiplicar a textura
            } else {
                gl.uniform1i(uMain.useTex, 0);
                gl.uniform3fv(uMain.objCol, knifeColor); // Cor do MTL se não houver textura
            }
            
            gl.bindVertexArray(vaoCannon); 
            const vCountGun = (cannonData.length > 36) ? cannonData.length/8 : 36; 
            gl.drawArrays(gl.TRIANGLES, 0, vCountGun);
            
            gl.enable(gl.DEPTH_TEST);
        }
    }

    let globalTime = 0;
    let lastTime = 0;
    const dayDuration = 120.0; 

    function render(now) {
        requestAnimationFrame(render);
        if (gameState !== 'PLAYING') {
            lastTime = now * 0.001; 
            return;
        }

        const currentTime = now * 0.001;
        const dt = currentTime - lastTime;
        lastTime = currentTime;
        globalTime += dt;

        updatePhysics();
        cam.recoil = Math.max(0, cam.recoil * 0.85); cam.flash *= 0.8;

        if(Math.random() < 0.01) {
            const r = Math.random();
            if (gameScore >= 100 && r < 0.1) enemies.push(new Bolsonaro('SUPER'));
            else if (gameScore >= 300 && r < 0.25) enemies.push(new Bolsonaro('MINI'));
            else enemies.push(new Bolsonaro('NORMAL'));
        }

        if(Math.random() < 0.0005) {
            hearts.push(new Heart());
        }

        for (let i = hearts.length - 1; i >= 0; i--) {
            if (!hearts[i].alive) hearts.splice(i, 1);
            else hearts[i].update(cam.pos);
        }

        for (let i = enemies.length - 1; i >= 0; i--) {
            if (!enemies[i].alive) { enemies.splice(i, 1); } else {
                const status = enemies[i].update(cam.pos);
                if (status === "HIT_PLAYER") {
                    playerHealth--; updateUI();
                    if (playerHealth <= 0) { doGameOver(); return; }
                }
                else if (status === "DROP_HEART") {
                    hearts.push(new Heart(enemies[i].pos));
                }
            }
        }
        
        if(isCharging) { const pct = Math.min(1.0, (performance.now() - chargeStartTime) / 1000) * 100; powerBar.style.width = `${pct}%`; }
        for(let i = projectiles.length - 1; i >= 0; i--) {
            if(projectiles[i].update(trees, walls, enemies)) projectiles.splice(i, 1);
        }

        // ===================================
        // CICLO DIA/NOITE & SKYBOX
        // ===================================
        
        const timeWithOffset = globalTime + 30.0; 
        const cycle = (timeWithOffset / dayDuration) * Math.PI * 2;
        const sunOrbitRad = 300.0; 
        
        const lightDir = vec3.fromValues(
            Math.cos(cycle) * sunOrbitRad,
            Math.sin(cycle) * sunOrbitRad,
            Math.cos(cycle) * 50.0
        );

        let tSky = Math.max(0, Math.min(1.0, (lightDir[1] + 100) / 200.0));
        let skyColor, lightColor;
        let skyTint = [1, 1, 1]; // Cor base do skybox
        
        if (lightDir[1] > -50) { 
            let t = Math.max(0, Math.min(1.0, (lightDir[1] + 50) / 100.0));
            if (t < 0.5) { 
                skyColor = lerpColor([0.8, 0.4, 0.2], [0.5, 0.7, 0.9], t * 2.0);
                lightColor = lerpColor([0.8, 0.5, 0.2], [1.2, 1.1, 0.9], t * 2.0);
                skyTint = [1.0, 0.8, 0.6]; // Entardecer
            } else { 
                skyColor = [0.5, 0.7, 0.9];
                lightColor = [1.2, 1.1, 0.9];
                skyTint = [1.0, 1.0, 1.0]; // Dia
            }
        } else { 
            skyColor = [0.05, 0.05, 0.1];
            lightColor = [0.2, 0.3, 0.5];
            skyTint = [0.1, 0.1, 0.2]; // Noite
        }

        // --- SHADOW PASS ---
        const lightProj = mat4.create(); mat4.ortho(lightProj, -120, 120, -120, 120, 1.0, 600.0); 
        const lightView = mat4.create(); 
        const lightPosReal = vec3.add(vec3.create(), cam.pos, lightDir);
        mat4.lookAt(lightView, lightPosReal, cam.pos, [0,1,0]);
        const lightSpaceMatrix = mat4.create(); mat4.multiply(lightSpaceMatrix, lightProj, lightView);

        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFBO.fbo); gl.viewport(0, 0, shadowFBO.size, shadowFBO.size);
        gl.clear(gl.DEPTH_BUFFER_BIT); gl.useProgram(shadowProg); gl.uniformMatrix4fv(uShadow.lightSpace, false, lightSpaceMatrix);
        drawScene(shadowProg, uShadow, true, lightDir); 
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // --- MAIN PASS ---
        gl.viewport(0, 0, canvas.width, canvas.height); 
        gl.clearColor(skyColor[0], skyColor[1], skyColor[2], 1.0); 
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 

        const proj = mat4.create(); mat4.perspective(proj, 60*Math.PI/180, canvas.width/canvas.height, 0.1, 1000.0); 
        const view = mat4.create(); 
        const tar = vec3.create(); vec3.add(tar, cam.pos, cam.front); 
        mat4.lookAt(view, cam.pos, tar, [0,1,0]);

        // ========================================================
        // SKYBOX (FUNDO)
        // ========================================================
        gl.depthFunc(gl.LEQUAL); // Importante para o Skybox ficar no fundo
        gl.useProgram(skyboxProg);
        gl.uniformMatrix4fv(uSkybox.proj, false, proj);
        const viewSky = mat4.clone(view); viewSky[12]=0; viewSky[13]=0; viewSky[14]=0; // Remove translação
        gl.uniformMatrix4fv(uSkybox.view, false, viewSky);
        gl.uniform3fv(uSkybox.tint, skyTint);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyboxTex);
        gl.bindVertexArray(vaoCube); gl.drawArrays(gl.TRIANGLES, 0, 36);
        gl.depthFunc(gl.LESS); // Volta ao normal

        // ========================================================
        // SOL E LUA (OVERLAY)
        // ========================================================
        gl.useProgram(mainProg);
        gl.uniformMatrix4fv(uMain.proj, false, proj);
        gl.uniformMatrix4fv(uMain.view, false, viewSky); // Usa a view do céu
        gl.uniform1i(uMain.isSun, 1); 

        // Sol
        let mSun = mat4.create();
        mat4.translate(mSun, mSun, lightDir); 
        mat4.scale(mSun, mSun, [20.0, 20.0, 20.0]); 
        gl.uniformMatrix4fv(uMain.model, false, mSun);
        gl.uniform3fv(uMain.objCol, [1.0, 1.0, 0.8]); 
        gl.bindVertexArray(vaoCelestial); gl.drawArrays(gl.TRIANGLES, 0, celestialData.length/8);

        // Lua
        let mMoon = mat4.create();
        const moonDir = vec3.scale(vec3.create(), lightDir, -1);
        mat4.translate(mMoon, mMoon, moonDir);
        mat4.scale(mMoon, mMoon, [15.0, 15.0, 15.0]);
        gl.uniformMatrix4fv(uMain.model, false, mMoon);
        gl.uniform3fv(uMain.objCol, [1.0, 1.0, 1.0]); 
        gl.bindVertexArray(vaoCelestial); gl.drawArrays(gl.TRIANGLES, 0, celestialData.length/8);

        gl.uniform1i(uMain.isSun, 0); 

        // ========================================================
        // MUNDO (FRENTE)
        // ========================================================
        gl.uniformMatrix4fv(uMain.view, false, view);
        gl.uniform3fv(uMain.viewPos, cam.pos); 
        gl.uniform3fv(uMain.lightPos, lightPosReal); 
        gl.uniform3fv(uMain.lightCol, lightColor);  
        gl.uniform1f(uMain.flash, cam.flash);
        gl.uniformMatrix4fv(uMain.lightSpaceMatrix, false, lightSpaceMatrix);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowFBO.depthMap); gl.uniform1i(uMain.shadowMap, 1); gl.activeTexture(gl.TEXTURE0);
        
        drawScene(mainProg, uMain, false, lightDir);
    }
    
    requestAnimationFrame(render);
}

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

init();