const params = {
    DIFFUSION: null,
    VISCOSITY: null,
    TIME_STEP: null,
    ITERATIONS: 4
}

class Canvas {

    cell_size = 30;
    W;
    H;
    I;
    J;

    N;

    constructor(ref) {

        this.el = document.querySelector(ref);
        this.W = +window.getComputedStyle(this.el).width.slice(0,-2);
        this.H = +window.getComputedStyle(this.el).height.slice(0,-2);

        this.el.width = this.W;
        this.el.height = this.H;

        this.I = Math.floor(this.W / this.cell_size);
        this.J = Math.floor(this.H / this.cell_size);

        this.N = this.I;

        this.ctx = this.el.getContext('2d');

        this.ctx.strokeStyle = 'green';
        this.ctx.lineWidth = 1;

    }

    build_grid() {

        //let I = 0;
        //let J = 0;

        for (let i = 0; i < this.W; i = i + this.cell_size) {

            this.ctx.beginPath();
            this.ctx.moveTo(i, 0);
            this.ctx.lineTo(i, this.H);
            this.ctx.stroke();
            //I++

        }

        for (let j = 0; j < this.H; j = j + this.cell_size) {

            this.ctx.beginPath();
            this.ctx.moveTo(0, j);
            this.ctx.lineTo(this.W, j);
            this.ctx.stroke();
            //J++

        }

        //this.I = I;
        //this.J = J;

    }

    getDims() {

        return {
            I: this.I,
            J: this.J
        }

    }

    getSize() {

        return this.I * this.J;

    }

}

class Vec {

    x;
    y;

    constructor(x, y) {

        this.x = x;
        this.y = y;

    }

    mod() {

        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2) )

    }

    add(vec_b) {

        this.x += vec_b.x;
        this.y += vec_b.y

    }

    mult(scalar) {

        this.x *= scalar;
        this.y *= scalar;

    }

    /* this make it possible to use the utility function without instantiating an object */
    static fromAngle(ang) {

        let x = Math.cos(ang);
        let y = Math.sin(ang);

        return new Vec(x, y)

    }

}

class Fluid {

    Vx; Vy  // vector field for velocity
    Vx0; Vy0 // previous velocity
    s;  // vector field for dye/plankton density
    density; // previous density?

    diffusion;
    viscosity;
    dt; // time_step

    constructor(diffusion, viscosity, time_step) {

        const size = N * N;

        this.Vx  = new Array(size).fill(0);
        this.Vx0 = new Array(size).fill(0);

        this.Vy  = new Array(size).fill(0);
        this.Vy0 = new Array(size).fill(0);

        this.s  = new Array(size).fill(0);
        this.density = new Array(size).fill(0);

        this.viscosity = viscosity;
        this.diffusion = diffusion;
        this.dt = time_step;

    }

    getIndex(x, y) {

        return x + y * N; //nof columns

    }

    addDensity(x, y, amount) {

        const index = this.getIndex(x, y);
        this.s[index] += amount;

    }

    addVelocity(x, y, amount) {

        const index = this.getIndex(x, y);
        this.v[index].x += amount.x;
        this.v[index].y += amount.y;

    }

    step() {

        const N       = this.size;
        const visc    = this.visc;
        const diff    = this.diff;
        const dt      = this.dt;

        const Vx      = this.Vx;
        const Vy      = this.Vy;

        const Vx0     = this.Vx0;
        const Vy0     = this.Vy0;

        const s       = this.s;
        const density = this.density;
        
        diffuse(1, Vx0, Vx, visc);
        diffuse(2, Vy0, Vy, visc);
        
        project(Vx0, Vy0, Vx, Vy);
        
        advect(1, Vx, Vx0, Vx0, Vy0);
        advect(2, Vy, Vy0, Vx0, Vy0);
        
        project(Vx, Vy, Vx0, Vy0);
        
        diffuse(0, s, density, diff);
        advect(0, density, s, Vx, Vy);

    }

    render_density() {

        for (let i = 0; i < N; i++) {

            for (let j = 0; j < N; j++) {

                const x = i * cv.cell_size;
                const y = j * cv.cell_size;
                const index = fluid.getIndex(i, j);
                const density = fluid.density[index];

                //if (i + j < 50) console.log(density);

                cv.ctx.fillStyle = (`rgb(${density}, ${density}, ${density})`);
                //cv.ctx.fillStyle = 'hotpink';
                cv.ctx.fillRect(x, y, cv.cell_size, cv.cell_size);
                //if (i + j < 100) console.log(x, y, cv.cell_size);
                
                
                //cv.ctx.fillStyle = (`rgb(${density}, ${density}, ${density})`);
                //cv.ctx.fill();

            }

        }

    }

}

function diffuse(b, x, x0, diffusion) {

    const dt = fluid.dt;

    const a = dt * diffusion * (N - 2) * (N - 2);
    solve_linear(b, x, x0, a, 1 + 6 * a);

}

function project(vX, vY, p, div) {

    const iter = params.ITERATIONS;

    for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
            div[fluid.getIndex(i, j)] = -0.5 * (
                     vX[fluid.getIndex(i+1, j  )]
                    -vX[fluid.getIndex(i-1, j  )]
                    +vY[fluid.getIndex(i  , j+1)]
                    -vY[fluid.getIndex(i  , j-1)]
                )/N;
            p[fluid.getIndex(i, j)] = 0;
        }
    }
    set_bnd(0, div); 
    set_bnd(0, p);
    solve_linear(0, p, div, 1, 6);
    
    for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
            vX[fluid.getIndex(i, j)] -= 0.5 * (  p[fluid.getIndex(i+1, j)]
                                            -p[fluid.getIndex(i-1, j)]) * N;
            vY[fluid.getIndex(i, j)] -= 0.5 * (  p[fluid.getIndex(i, j+1)]
                                            -p[fluid.getIndex(i, j-1)]) * N;
        }
    }

    set_bnd(1, vX);
    set_bnd(2, vY);

}

function advect(b, d, d0,  vX, vY) {

    // b controls the set boundaries

    const dt = fluid.dt;
    

    let i0, i1, j0, j1;
    
    let dtx = dt * (N - 2);
    let dty = dt * (N - 2);
    
    let s0, s1, t0, t1;
    let tmp1, tmp2, x, y;
    
    let Nfloat = N;
    let ifloat, jfloat;
    let i, j, k;
    
    for(j = 1, jfloat = 1; j < N - 1; j++, jfloat++) { 
        for(i = 1, ifloat = 1; i < N - 1; i++, ifloat++) {
            tmp1 = dtx * vX[fluid.getIndex(i, j, k)];
            tmp2 = dty * vY[fluid.getIndex(i, j, k)];

            x    = ifloat - tmp1; 
            y    = jfloat - tmp2;
            
            if(x < 0.5) x = 0.5; 
            if(x > Nfloat + 0.5) x = Nfloat + 0.5; 
            i0 = Math.floor(x); 
            i1 = i0 + 1.0;
            if(y < 0.5) y = 0.5; 
            if(y > Nfloat + 0.5) y = Nfloat + 0.5; 
            j0 = Math.floor(y);
            j1 = j0 + 1.0; 
            
            s1 = x - i0; 
            s0 = 1.0 - s1; 
            t1 = y - j0; 
            t0 = 1.0 - t1;
            
            let i0i = i0;
            let i1i = i1;
            let j0i = j0;
            let j1i = j1;
            
            d[fluid.getIndex(i, j)] = 
            
                s0 * ( t0 * d0[fluid.getIndex(i0i, j0i)] + t1 * d0[fluid.getIndex(i0i, j1i)] )
                +
                s1 * ( t0 * d0[fluid.getIndex(i1i, j0i)] + t1 * d0[fluid.getIndex(i1i, j1i)] );
        }
    }

    set_bnd(b, d);
}

function set_bnd(b, x) {

    // reverses the velocities at the boundaries 
    for(let i = 1; i < N - 1; i++) {
        x[fluid.getIndex(i, 0   )] = b == 2 ? -x[fluid.getIndex(i, 1  )] : x[fluid.getIndex(i, 1  )];
        x[fluid.getIndex(i, N-1 )] = b == 2 ? -x[fluid.getIndex(i, N-2)] : x[fluid.getIndex(i, N-2)];
    }
        
    for(let j = 1; j < N - 1; j++) {
        x[fluid.getIndex(0  , j)] = b == 1 ? -x[fluid.getIndex(1  , j)] : x[fluid.getIndex(1  , j)];
        x[fluid.getIndex(N-1, j)] = b == 1 ? -x[fluid.getIndex(N-2, j)] : x[fluid.getIndex(N-2, j)];
    }
    
    x[fluid.getIndex(0, 0)]     = 0.5 * ( x[fluid.getIndex(1, 0)] + x[fluid.getIndex(0, 1)] );

    x[fluid.getIndex(0, N-1)]   = 0.5 * (x[fluid.getIndex(1, N-1)] + x[fluid.getIndex(0, N-2)]);

    x[fluid.getIndex(N-1, 0)]   = 0.5 * (x[fluid.getIndex(N-2, 0)] + x[fluid.getIndex(N-1, 1)]);

    x[fluid.getIndex(N-1, N-1)] = 0.5 * (x[fluid.getIndex(N-2, N-1)] + x[fluid.getIndex(N-1, N-2)]);

}

function solve_linear(b, x, x0, a, c, I, J) {

    const iter = params.ITERATIONS;

    //As stated before, this function is mysterious, but it does some kind of solving. this is done by running through the whole array and setting each cell to a combination of its neighbors. It does this several times; the more iterations it does, the more accurate the results, but the slower things run. In the step function above, four iterations are used. After each iteration, it resets the boundaries so the calculations don't explode.

    const cRecip = 1.0 / c;
    for (let k = 0; k < iter; k++) { // for each iteration
        for (let j = 1; j < J - 1; j++) { // loop through the entire grid (except the boundaries)
            for (let i = 1; i < I - 1; i++) { // ... first along the rows 
                x[fluid.getIndex(i, j)] =
                    (x0[fluid.getIndex(i, j)]
                        + a*(    x[fluid.getIndex(i+1, j  )]
                                +x[fluid.getIndex(i-1, j  )]
                                +x[fluid.getIndex(i  , j+1)]
                                +x[fluid.getIndex(i  , j-1)]
                        )) * cRecip;
            }
        }
        set_bnd(b, x);
    }
}

const cv = new Canvas('canvas');
const N = cv.N;
const fluid = new Fluid(0, 0, 0.1);

let dragging = false;

cv.el.addEventListener('mousedown', (e) => {

    console.log('on');
    dragging = true;

});

cv.el.addEventListener('mousemove', (e) => {

    if (dragging) {
        console.log(e.clientX, e.clientY);

        const i = Math.floor(e.clientX / cv.cell_size);
        const j = Math.floor(e.clientY / cv.cell_size);
        fluid.addDensity(i, j, 100);

    }

});

cv.el.addEventListener('mouseup', (e) => {

    console.log('off');
    dragging = false;

});

function draw() {
    fluid.step();
    fluid.render_density();
}


/* animation loop */
let previous, elapsed;

function animate(timestamp) {

    if (!previous) previous = timestamp;
    elapsed = timestamp - previous;
    draw();
    previous = timestamp;
    window.requestAnimationFrame(animate);

}

window.requestAnimationFrame(animate);