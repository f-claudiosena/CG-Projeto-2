const Math3D = {
    identity: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
    
    perspective: (fov, aspect, near, far) => {
        const f = 1.0 / Math.tan(fov / 2), r = 1.0 / (near - far);
        return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(near+far)*r,-1, 0,0,(2*near*far)*r,0]);
    },

    multiply: (a, b) => {
        const out = new Float32Array(16);
        for(let i=0; i<4; i++) {
            for(let j=0; j<4; j++) {
                out[i*4+j] = a[i*4+0]*b[0*4+j] + a[i*4+1]*b[1*4+j] + a[i*4+2]*b[2*4+j] + a[i*4+3]*b[3*4+j];
            }
        }
        return out;
    },

    translate: (m, x, y, z) => {
        const t = Math3D.identity();
        t[12] = x; t[13] = y; t[14] = z;
        return Math3D.multiply(m, t);
    },

    rotateY: (m, angle) => {
        const r = Math3D.identity(), c = Math.cos(angle), s = Math.sin(angle);
        r[0] = c; r[2] = -s; r[8] = s; r[10] = c;
        return Math3D.multiply(m, r);
    }
};