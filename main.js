let battery = 1.0;
let gameRunning = false;

function startGame() {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    gameRunning = true;
    init();
}

async function init() {
    const canvas = document.getElementById("glCanvas");
    const gl = canvas.getContext("webgl");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const program = gl.createProgram();
    const compile = (t, s) => {
        const sh = gl.createShader(t);
        gl.shaderSource(sh, s);
        gl.compileShader(sh);
        return sh;
    };
    gl.attachShader(program, compile(gl.VERTEX_SHADER, document.getElementById("vs").text));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, document.getElementById("fs").text));
    gl.linkProgram(program);
    gl.useProgram(program);

    // Geometria: Corredor + Inimigo (Triângulos com Normais)
    const data = new Float32Array([
        // Chão (Posição x,y,z | Normal x,y,z)
        -10,0,-20, 0,1,0,  10,0,-20, 0,1,0,  -10,0,10, 0,1,0,
        -10,0,10, 0,1,0,   10,0,-20, 0,1,0,   10,0,10, 0,1,0,
        // Inimigo (Cubo simples animado)
        -0.5,0,-0.5, 0,0,1, 0.5,0,-0.5, 0,0,1, 0,1,0, 0,0,1
    ]);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, "aPosition");
    const aNorm = gl.getAttribLocation(program, "aNormal");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 24, 12);

    const uMvp = gl.getUniformLocation(program, "uMvpMatrix");
    const uModel = gl.getUniformLocation(program, "uModelMatrix");
    const uLight = gl.getUniformLocation(program, "uLightPos");
    const uBatt = gl.getUniformLocation(program, "uBattery");

    let camPos = [0, 1.7, 5];
    const keys = {};
    window.onkeydown = e => keys[e.key.toLowerCase()] = true;
    window.onkeyup = e => keys[e.key.toLowerCase()] = false;

    function render(time) {
        if(!gameRunning) return;
        time *= 0.001;

        // Bateria: Consome 1% por segundo
        battery -= 0.0005; 
        if(battery < 0) battery = 0;
        document.getElementById('battery-fill').style.width = (battery * 100) + "%";

        // Movimentação
        if(keys['w']) camPos[2] -= 0.1;
        if(keys['s']) camPos[2] += 0.1;
        if(keys['a']) camPos[0] -= 0.1;
        if(keys['d']) camPos[0] += 0.1;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        const proj = Math3D.perspective(Math.PI/4, canvas.width/canvas.height, 0.1, 100);
        let view = Math3D.translate(Math3D.identity(), -camPos[0], -camPos[1], -camPos[2]);
        const vp = Math3D.multiply(proj, view);

        // Desenhar Cenário
        gl.uniformMatrix4fv(uMvp, false, vp);
        gl.uniformMatrix4fv(uModel, false, Math3D.identity());
        gl.uniform3fv(uLight, camPos);
        gl.uniform1f(uBatt, battery);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // Desenhar Inimigo Animado (Requisito A-III)
        let enemyModel = Math3D.translate(Math3D.identity(), Math.sin(time)*2, 0, -5);
        gl.uniformMatrix4fv(uMvp, false, Math3D.multiply(vp, enemyModel));
        gl.uniformMatrix4fv(uModel, false, enemyModel);
        gl.drawArrays(gl.TRIANGLES, 6, 3);

        requestAnimationFrame(render);
    }
    render(0);
}