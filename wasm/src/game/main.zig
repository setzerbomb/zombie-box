const canvas_width: f32 = 1920.0;
const canvas_height: f32 = 1080.0;

const player_width: f32 = 40.0;
const player_height: f32 = 40.0;
const player_speed: f32 = 320.0 * 1.5;

const zombie_size: f32 = 40.0;
const zombie_speed: f32 = 130.0;

const bullet_size: f32 = 8.0;
const bullet_speed: f32 = 900.0;

const max_zombies: usize = 64;
const max_bullets: usize = 128;

const rescue_radius: f32 = 40.0;
const rescue_invulnerability_time: f32 = 0.25;

const initial_challenge_time: f32 = 5.0;
const challenge_decay_rate: f32 = 0.12;

const Zombie = struct {
    x: f32 = 0.0,
    y: f32 = 0.0,
    active: bool = false,
};

const Bullet = struct {
    x: f32 = 0.0,
    y: f32 = 0.0,

    velocity_x: f32 = 0.0,
    velocity_y: f32 = 0.0,

    active: bool = false,
};

var player_x: f32 =
    (canvas_width - player_width) / 2.0;

var player_y: f32 =
    (canvas_height - player_height) / 2.0;

var left_pressed: bool = false;
var right_pressed: bool = false;
var up_pressed: bool = false;
var down_pressed: bool = false;

var shooting: bool = false;

var facing_x: f32 = 0.0;
var facing_y: f32 = -1.0;

var zombies: [max_zombies]Zombie = undefined;
var bullets: [max_bullets]Bullet = undefined;

var initialized: bool = false;

var zombie_spawn_timer: f32 = 0.5;
var shooting_timer: f32 = 0.0;
var invulnerability_timer: f32 = 0.0;

var score: u32 = 0;
var game_over: bool = false;

var challenge_active: bool = false;
var successful_escapes: u32 = 0;

var random_state: u32 = 0x12345678;

fn randomU32() u32 {
    var value = random_state;

    value ^= value << 13;
    value ^= value >> 17;
    value ^= value << 5;

    random_state = value;

    return value;
}

fn randomFloat() f32 {
    const value = randomU32() & 0x00FFFFFF;

    return @as(f32, @floatFromInt(value)) /
        16777216.0;
}

fn getChallengeTimeLimitInternal() f32 {
    const escapes: f32 =
        @floatFromInt(successful_escapes);

    return initial_challenge_time *
        @exp(-challenge_decay_rate * escapes);
}

fn rectanglesOverlap(
    first_x: f32,
    first_y: f32,
    first_width: f32,
    first_height: f32,
    second_x: f32,
    second_y: f32,
    second_width: f32,
    second_height: f32,
) bool {
    return first_x < second_x + second_width and
        first_x + first_width > second_x and
        first_y < second_y + second_height and
        first_y + first_height > second_y;
}

fn clearZombies() void {
    for (&zombies) |*zombie| {
        zombie.* = .{};
    }
}

fn clearBullets() void {
    for (&bullets) |*bullet| {
        bullet.* = .{};
    }
}

fn spawnZombie() void {
    for (&zombies) |*zombie| {
        if (zombie.active) {
            continue;
        }

        const edge = randomU32() % 4;

        switch (edge) {
            0 => {
                zombie.x =
                    randomFloat() *
                    (canvas_width - zombie_size);

                zombie.y = 0.0;
            },
            1 => {
                zombie.x =
                    canvas_width - zombie_size;

                zombie.y =
                    randomFloat() *
                    (canvas_height - zombie_size);
            },
            2 => {
                zombie.x =
                    randomFloat() *
                    (canvas_width - zombie_size);

                zombie.y =
                    canvas_height - zombie_size;
            },
            else => {
                zombie.x = 0.0;

                zombie.y =
                    randomFloat() *
                    (canvas_height - zombie_size);
            },
        }

        zombie.active = true;
        return;
    }
}

fn spawnBullet() void {
    const player_center_x =
        player_x + player_width / 2.0;

    const player_center_y =
        player_y + player_height / 2.0;

    for (&bullets) |*bullet| {
        if (bullet.active) {
            continue;
        }

        bullet.x =
            player_center_x +
            facing_x * (player_width / 2.0) -
            bullet_size / 2.0;

        bullet.y =
            player_center_y +
            facing_y * (player_height / 2.0) -
            bullet_size / 2.0;

        bullet.velocity_x =
            facing_x * bullet_speed;

        bullet.velocity_y =
            facing_y * bullet_speed;

        bullet.active = true;
        return;
    }
}

fn updatePlayer(delta_seconds: f32) void {
    var x_axis: f32 = 0.0;
    var y_axis: f32 = 0.0;

    if (left_pressed) {
        x_axis -= 1.0;
    }

    if (right_pressed) {
        x_axis += 1.0;
    }

    if (up_pressed) {
        y_axis -= 1.0;
    }

    if (down_pressed) {
        y_axis += 1.0;
    }

    const axis_length = @sqrt(
        x_axis * x_axis +
            y_axis * y_axis,
    );

    if (axis_length > 0.0) {
        x_axis /= axis_length;
        y_axis /= axis_length;

        facing_x = x_axis;
        facing_y = y_axis;
    }

    player_x +=
        x_axis *
        player_speed *
        delta_seconds;

    player_y +=
        y_axis *
        player_speed *
        delta_seconds;

    if (player_x < 0.0) {
        player_x = 0.0;
    }

    const maximum_x =
        canvas_width - player_width;

    if (player_x > maximum_x) {
        player_x = maximum_x;
    }

    if (player_y < 0.0) {
        player_y = 0.0;
    }

    const maximum_y =
        canvas_height - player_height;

    if (player_y > maximum_y) {
        player_y = maximum_y;
    }
}

fn updateBullets(delta_seconds: f32) void {
    for (&bullets) |*bullet| {
        if (!bullet.active) {
            continue;
        }

        bullet.x +=
            bullet.velocity_x *
            delta_seconds;

        bullet.y +=
            bullet.velocity_y *
            delta_seconds;

        const outside_map =
            bullet.x + bullet_size < 0.0 or
            bullet.y + bullet_size < 0.0 or
            bullet.x > canvas_width or
            bullet.y > canvas_height;

        if (outside_map) {
            bullet.active = false;
        }
    }
}

fn updateZombies(delta_seconds: f32) void {
    const player_center_x =
        player_x + player_width / 2.0;

    const player_center_y =
        player_y + player_height / 2.0;

    for (&zombies) |*zombie| {
        if (!zombie.active) {
            continue;
        }

        const zombie_center_x =
            zombie.x + zombie_size / 2.0;

        const zombie_center_y =
            zombie.y + zombie_size / 2.0;

        const direction_x =
            player_center_x - zombie_center_x;

        const direction_y =
            player_center_y - zombie_center_y;

        const distance = @sqrt(
            direction_x * direction_x +
                direction_y * direction_y,
        );

        if (distance > 0.001) {
            zombie.x +=
                direction_x /
                distance *
                zombie_speed *
                delta_seconds;

            zombie.y +=
                direction_y /
                distance *
                zombie_speed *
                delta_seconds;
        }

        var zombie_was_hit = false;

        for (&bullets) |*bullet| {
            if (!bullet.active) {
                continue;
            }

            if (rectanglesOverlap(
                bullet.x,
                bullet.y,
                bullet_size,
                bullet_size,
                zombie.x,
                zombie.y,
                zombie_size,
                zombie_size,
            )) {
                bullet.active = false;
                zombie.active = false;

                score += 1;
                zombie_was_hit = true;

                break;
            }
        }

        if (zombie_was_hit) {
            continue;
        }

        if (invulnerability_timer > 0.0) {
            continue;
        }

        if (rectanglesOverlap(
            player_x,
            player_y,
            player_width,
            player_height,
            zombie.x,
            zombie.y,
            zombie_size,
            zombie_size,
        )) {
            challenge_active = true;
            shooting = false;
            return;
        }
    }
}

fn killZombiesNearPlayer() void {
    const player_right =
        player_x + player_width;

    const player_bottom =
        player_y + player_height;

    const rescue_radius_squared =
        rescue_radius * rescue_radius;

    for (&zombies) |*zombie| {
        if (!zombie.active) {
            continue;
        }

        const zombie_right =
            zombie.x + zombie_size;

        const zombie_bottom =
            zombie.y + zombie_size;

        var distance_x: f32 = 0.0;
        var distance_y: f32 = 0.0;

        if (zombie.x > player_right) {
            distance_x = zombie.x - player_right;
        } else if (player_x > zombie_right) {
            distance_x = player_x - zombie_right;
        }

        if (zombie.y > player_bottom) {
            distance_y = zombie.y - player_bottom;
        } else if (player_y > zombie_bottom) {
            distance_y = player_y - zombie_bottom;
        }

        const distance_squared =
            distance_x * distance_x +
            distance_y * distance_y;

        if (distance_squared <= rescue_radius_squared) {
            zombie.active = false;
        }
    }
}

fn resetGame() void {
    player_x =
        (canvas_width - player_width) / 2.0;

    player_y =
        (canvas_height - player_height) / 2.0;

    facing_x = 0.0;
    facing_y = -1.0;

    left_pressed = false;
    right_pressed = false;
    up_pressed = false;
    down_pressed = false;

    shooting = false;

    shooting_timer = 0.0;
    zombie_spawn_timer = 0.5;
    invulnerability_timer = 0.0;

    score = 0;
    game_over = false;

    challenge_active = false;
    successful_escapes = 0;

    clearZombies();
    clearBullets();

    initialized = true;
}

export fn setInput(
    left: i32,
    right: i32,
    up: i32,
    down: i32,
) void {
    left_pressed = left != 0;
    right_pressed = right != 0;
    up_pressed = up != 0;
    down_pressed = down != 0;
}

export fn setShooting(value: i32) void {
    shooting = value != 0;
}

export fn setSeed(seed: u32) void {
    random_state = if (seed == 0)
        0x12345678
    else
        seed;
}

export fn update(delta_seconds: f32) void {
    if (!initialized) {
        resetGame();
    }

    if (game_over or challenge_active) {
        return;
    }

    const delta = if (delta_seconds > 0.05)
        0.05
    else
        delta_seconds;

    if (invulnerability_timer > 0.0) {
        invulnerability_timer -= delta;

        if (invulnerability_timer < 0.0) {
            invulnerability_timer = 0.0;
        }
    }

    updatePlayer(delta);

    shooting_timer -= delta;

    if (shooting and shooting_timer <= 0.0) {
        spawnBullet();
        shooting_timer = 0.16;
    }

    zombie_spawn_timer -= delta;

    if (zombie_spawn_timer <= 0.0) {
        spawnZombie();
        zombie_spawn_timer = 1.0;
    }

    updateBullets(delta);
    updateZombies(delta);
}

export fn reset() void {
    resetGame();
}

export fn resolveChallengeSuccess() void {
    if (!challenge_active or game_over) {
        return;
    }

    killZombiesNearPlayer();

    successful_escapes += 1;
    challenge_active = false;
    invulnerability_timer =
        rescue_invulnerability_time;
}

export fn resolveChallengeFailure() void {
    if (!challenge_active or game_over) {
        return;
    }

    challenge_active = false;
    game_over = true;
    shooting = false;
}

export fn getPlayerX() f32 {
    return player_x;
}

export fn getPlayerY() f32 {
    return player_y;
}

export fn getPlayerWidth() f32 {
    return player_width;
}

export fn getPlayerHeight() f32 {
    return player_height;
}

export fn getFacingX() f32 {
    return facing_x;
}

export fn getFacingY() f32 {
    return facing_y;
}

export fn getZombieSize() f32 {
    return zombie_size;
}

export fn getMaxZombies() i32 {
    return @intCast(max_zombies);
}

export fn isZombieActive(index: i32) i32 {
    if (index < 0) {
        return 0;
    }

    const array_index: usize =
        @intCast(index);

    if (array_index >= max_zombies) {
        return 0;
    }

    return if (zombies[array_index].active)
        1
    else
        0;
}

export fn getZombieX(index: i32) f32 {
    if (index < 0) {
        return 0.0;
    }

    const array_index: usize =
        @intCast(index);

    if (array_index >= max_zombies) {
        return 0.0;
    }

    return zombies[array_index].x;
}

export fn getZombieY(index: i32) f32 {
    if (index < 0) {
        return 0.0;
    }

    const array_index: usize =
        @intCast(index);

    if (array_index >= max_zombies) {
        return 0.0;
    }

    return zombies[array_index].y;
}

export fn getBulletSize() f32 {
    return bullet_size;
}

export fn getMaxBullets() i32 {
    return @intCast(max_bullets);
}

export fn isBulletActive(index: i32) i32 {
    if (index < 0) {
        return 0;
    }

    const array_index: usize =
        @intCast(index);

    if (array_index >= max_bullets) {
        return 0;
    }

    return if (bullets[array_index].active)
        1
    else
        0;
}

export fn getBulletX(index: i32) f32 {
    if (index < 0) {
        return 0.0;
    }

    const array_index: usize =
        @intCast(index);

    if (array_index >= max_bullets) {
        return 0.0;
    }

    return bullets[array_index].x;
}

export fn getBulletY(index: i32) f32 {
    if (index < 0) {
        return 0.0;
    }

    const array_index: usize =
        @intCast(index);

    if (array_index >= max_bullets) {
        return 0.0;
    }

    return bullets[array_index].y;
}

export fn getScore() u32 {
    return score;
}

export fn getGameOver() i32 {
    return if (game_over) 1 else 0;
}

export fn getChallengeActive() i32 {
    return if (challenge_active) 1 else 0;
}

export fn getChallengeTimeLimit() f32 {
    return getChallengeTimeLimitInternal();
}

export fn getSuccessfulEscapes() u32 {
    return successful_escapes;
}
