const std = @import("std");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});

    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const wasm = b.addExecutable(.{
        .name = "game",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/game/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
        .use_llvm = true,
    });

    // O navegador chamará diretamente as funções exportadas.
    // Portanto, não haverá main() nem _start().
    wasm.entry = .disabled;

    // Mantém os símbolos exportados visíveis no módulo WebAssembly.
    wasm.rdynamic = true;

    b.installArtifact(wasm);
}
