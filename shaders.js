export const vsSource = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aTex;
layout(location=2) in vec3 aNorm;

uniform mat4 uProj, uView, uModel;
uniform mat3 uNormMat;

out vec3 vPos, vNorm;
out vec2 vTex;

void main() {
    vPos = vec3(uModel * vec4(aPos, 1.0));
    vNorm = normalize(uNormMat * aNorm);
    vTex = aTex;
    gl_Position = uProj * uView * vec4(vPos, 1.0);
}`;

export const fsSource = `#version 300 es
precision highp float;

in vec3 vPos, vNorm;
in vec2 vTex;

uniform vec3 uLightPos, uViewPos, uLightCol, uObjCol;
uniform bool uUseTex;
uniform sampler2D uSamp;
uniform float uFlash; 

out vec4 fCol;

void main() {
    vec3 n = normalize(vNorm);
    vec3 lDir = normalize(uLightPos - vPos);
    vec3 vDir = normalize(uViewPos - vPos);
    vec3 rDir = reflect(-lDir, n);

    // PHONG
    vec3 amb = 0.2 * uLightCol;
    float d = max(dot(n, lDir), 0.0);
    vec3 diff = d * uLightCol;
    float s = pow(max(dot(vDir, rDir), 0.0), 32.0);
    vec3 spec = 0.6 * s * uLightCol;

    vec3 base = uUseTex ? texture(uSamp, vTex).rgb : uObjCol;
    vec3 final = (amb + diff + spec + uFlash) * base;
    fCol = vec4(final, 1.0);
}`;