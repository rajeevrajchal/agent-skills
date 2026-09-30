# C# (Godot .NET)

## When C# is the right choice

- Team already knows C#/.NET, or the game has heavy algorithmic code (procedural generation, simulation, pathfinding over large grids) where C#'s speed matters.
- You need NuGet libraries.

Costs: requires the .NET editor build and SDK; **web export is not supported for C# projects in Godot 4**; hot-reload is weaker than GDScript's; interop calls into the engine (`GetNode`, property access) still cross a marshaling boundary, so tight loops calling the engine gain less than you'd expect. Mixed projects (GDScript for glue, C# for heavy systems) work, but calling across languages is untyped and stringly — keep the boundary narrow.

## Script shape

```csharp
using Godot;

public partial class Enemy : CharacterBody2D   // partial is required (source generators)
{
    [Signal] public delegate void DiedEventHandler(Enemy enemy);
    [Signal] public delegate void HealthChangedEventHandler(int current, int maximum);

    [Export] public EnemyStats Stats { get; set; } = null!;
    [ExportGroup("Movement")]
    [Export(PropertyHint.Range, "0,2000,10")] public float Acceleration { get; set; } = 900f;

    private int _health;
    private AnimatedSprite2D _sprite = null!;

    public override void _Ready()
    {
        Stats = (EnemyStats)Stats.Duplicate();
        _health = Stats.MaxHealth;
        _sprite = GetNode<AnimatedSprite2D>("%Sprite");
    }

    public override void _PhysicsProcess(double delta)   // delta is double in C#
    {
        var dt = (float)delta;
        // ...
        MoveAndSlide();
    }

    public void TakeDamage(int amount)
    {
        _health = Mathf.Max(_health - amount, 0);
        EmitSignal(SignalName.HealthChanged, _health, Stats.MaxHealth);
        if (_health == 0)
        {
            EmitSignal(SignalName.Died, this);
            QueueFree();
        }
    }
}
```

- The class name must match the file name, and the class must be `partial`.
- Signal delegates end in `EventHandler`; the signal name drops the suffix (`Died`). Generated `SignalName.Died`, `MethodName.X`, `PropertyName.X` avoid string typos.
- Subscribe with C# events for C#-to-C# wiring: `enemy.Died += OnEnemyDied;` — when the emitter outlives the listener, unsubscribe (`-=`) in `_ExitTree`. Lambdas in particular can't be tied to the listener's lifetime and keep firing into a freed node. Alternatively `enemy.Connect(Enemy.SignalName.Died, Callable.From<Enemy>(OnEnemyDied))`.
- Custom Resources: `[GlobalClass] public partial class EnemyStats : Resource` with `[Export]` properties to make them creatable in the Inspector.

## Lifetime and memory

- `GodotObject`s are owned by the engine; C# wrappers can outlive them. Check `GodotObject.IsInstanceValid(obj)` after `await`/signals, and don't cache nodes past their `_ExitTree`.
- Non-Node `GodotObject`s you create (`new SomeObject()` deriving from `GodotObject`, not `RefCounted`) must be freed with `.Free()`.
- Avoid allocations in `_Process`/`_PhysicsProcess` (LINQ, lambdas capturing locals, `new` arrays, string formatting): GC pauses show up as frame spikes. Reuse buffers; use `Span<T>`/structs for math.
- Godot collections (`Godot.Collections.Array/Dictionary`) marshal to the engine; use `System.Collections.Generic` for internal data and convert only at the boundary.
- Engine structs (`Vector2`, `Transform3D`) are value types — `Position.X = 5` doesn't compile; assign a modified copy: `Position = Position with { X = 5 }` or `var p = Position; p.X = 5; Position = p;`.

## Async

```csharp
await ToSignal(GetTree().CreateTimer(0.5, processAlways: false), SceneTreeTimer.SignalName.Timeout);
if (!IsInstanceValid(this) || !IsInsideTree()) return;
```

`async void` only for Godot callbacks/signal handlers; everywhere else return `Task` and handle exceptions — an exception in `async void` is easy to lose.

## Tooling

- Nullable reference types on (`<Nullable>enable</Nullable>`), treat warnings seriously; use `null!` only for fields assigned in `_Ready`.
- Unit-test pure C# logic with xUnit/NUnit in a separate project without the engine; engine-dependent tests with GdUnit4's C# support.
- Rebuild (Alt+B / build button) before running after changes that add exports or signals, or the editor won't see them.
