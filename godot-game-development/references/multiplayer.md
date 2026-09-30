# Multiplayer (High-Level API)

Multiplayer multiplies every architecture decision. Before writing code, settle:

1. **Topology**: listen server (one player hosts) or dedicated server (headless export)? Peer-to-peer lockstep is not viable on Godot's non-deterministic physics.
2. **Authority**: the server is authoritative for game state (health, scores, spawns, hits). Clients are authoritative only for their own input.
3. **Transport**: `ENetMultiplayerPeer` (UDP, desktop/mobile), `WebSocketMultiplayerPeer` (web-compatible), `WebRTCMultiplayerPeer` (browser P2P with a signaling server), or a platform SDK (Steam) via GDExtension.
4. **Latency handling**: what does the player see while waiting for the server — nothing (turn-based), interpolation of others (most games), client-side prediction of self (action games)?

## Setup

```gdscript
# network.gd (autoload "Network")
extends Node

const PORT := 7777
const MAX_CLIENTS := 8

signal player_connected(peer_id: int)
signal player_disconnected(peer_id: int)

func host() -> Error:
	var peer := ENetMultiplayerPeer.new()
	var err := peer.create_server(PORT, MAX_CLIENTS)
	if err != OK:
		return err
	multiplayer.multiplayer_peer = peer
	multiplayer.peer_connected.connect(func(id: int) -> void: player_connected.emit(id))
	multiplayer.peer_disconnected.connect(func(id: int) -> void: player_disconnected.emit(id))
	return OK

func join(address: String) -> Error:
	var peer := ENetMultiplayerPeer.new()
	var err := peer.create_client(address, PORT)
	if err != OK:
		return err
	multiplayer.multiplayer_peer = peer
	multiplayer.connection_failed.connect(_on_connection_failed)
	multiplayer.server_disconnected.connect(_on_server_disconnected)
	return OK

func _on_connection_failed() -> void:
	multiplayer.multiplayer_peer = null

func _on_server_disconnected() -> void:
	multiplayer.multiplayer_peer = null
	get_tree().change_scene_to_file("res://ui/main_menu.tscn")
```

(Lambdas are acceptable here: the autoload and `multiplayer` share a lifetime.)

## Spawning and synchronization

- `MultiplayerSpawner`: set `spawn_path` to the container node and add spawnable scenes. When the **server** `add_child`s one of those scenes under the container, it's replicated to clients automatically. Clients must never spawn replicated nodes themselves.
- `MultiplayerSynchronizer` inside the spawned scene: pick properties to replicate (position, velocity, animation state). Set `replication_interval` / `delta_interval` to reduce bandwidth; use `visibility` filters for interest management.
- Name spawned player nodes by peer ID (`player.name = str(peer_id)`) so paths match on every peer.
- Input authority pattern: the player scene contains an `InputSynchronizer` child whose authority is the owning client; the body itself stays server-authoritative.

```gdscript
# player.gd (server-authoritative body)
@onready var _input: PlayerInput = %PlayerInput   # MultiplayerSynchronizer syncing `direction`, `jump`

func _enter_tree() -> void:
	# Only the input node belongs to the client; the body stays owned by the server (peer 1).
	%PlayerInput.set_multiplayer_authority(name.to_int())

func _physics_process(delta: float) -> void:
	if not multiplayer.is_server():
		return                    # clients just render synced position (optionally interpolate)
	velocity.x = _input.direction.x * speed
	...
	move_and_slide()
```

## RPCs

```gdscript
var _players: Dictionary[int, Player] = {}   # peer_id → Player, filled by the server when spawning

@rpc("any_peer", "call_remote", "reliable")
func request_pickup(item_path: NodePath) -> void:
	if not multiplayer.is_server():
		return
	var sender := multiplayer.get_remote_sender_id()
	var item := get_node_or_null(item_path) as Pickup
	var player: Player = _players.get(sender)
	# Validate everything: existence, range, cooldowns, ownership. Clients lie.
	if item == null or player == null:
		return
	if player.global_position.distance_to(item.global_position) > PICKUP_RANGE:
		return
	item.collect_by(player)
	show_pickup_effect.rpc(item.global_position)

@rpc("authority", "call_local", "unreliable")
func show_pickup_effect(at: Vector2) -> void:
	...
```

- `"authority"` (default): only the node's multiplayer authority may call it. `"any_peer"`: anyone — must validate `get_remote_sender_id()` and every argument.
- `"reliable"` for state changes that must arrive (pickup, death, chat); `"unreliable"` for high-frequency cosmetic or superseded data (effects, positions); `"unreliable_ordered"` for streams where old packets should be dropped.
- Send the smallest data: IDs and numbers, never whole nodes or Resources.
- Use `channel` indices to prevent a flood of unreliable data delaying reliable messages.

## Testing

- Debug → Customize Run Instances (4.3+) to launch multiple instances with different arguments (`--server`, `--client`), all attached to the debugger.
- Simulate latency/loss at the OS level (e.g. `tc netem` on Linux, clumsy on Windows); LAN testing hides most bugs.
- Test join-in-progress, host leaving, and client disconnect mid-action — those are where state desyncs.

## Security checklist

- No `any_peer` RPC without validating sender, rate, and arguments.
- Clients never decide damage, currency, inventory, or scores.
- Don't `str_to_var`/`bytes_to_var_with_objects` data received from peers.
- Dedicated servers: export with the `dedicated_server` feature/"Dedicated Server" export mode to strip textures and audio, run with `--headless`.
