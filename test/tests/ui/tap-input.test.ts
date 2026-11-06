import { AbilityId } from "#enums/ability-id";
import { Command } from "#enums/command";
import { MoveId } from "#enums/move-id";
import { MoveUseMode } from "#enums/move-use-mode";
import { SpeciesId } from "#enums/species-id";
import { UiMode } from "#enums/ui-mode";
import type { CommandPhase } from "#phases/command-phase";
import { GameManager } from "#test/framework/game-manager";
import type { BallUiHandler } from "#ui/ball-ui-handler";
import type { OptionSelectUiHandler } from "#ui/option-select-ui-handler";
import Phaser from "phaser";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

describe("UI - Tap input", () => {
  let phaserGame: Phaser.Game;
  let game: GameManager;

  beforeAll(() => {
    phaserGame = new Phaser.Game({
      type: Phaser.HEADLESS,
    });
  });

  beforeEach(() => {
    game = new GameManager(phaserGame);
    game.override
      .battleStyle("single")
      .ability(AbilityId.BALL_FETCH)
      .enemyAbility(AbilityId.BALL_FETCH)
      .enemySpecies(SpeciesId.MAGIKARP)
      .enemyMoveset(MoveId.SPLASH);
  });

  // Leaving the fight menu requires an active `CommandPhase`, which is gone by the time the next test starts
  afterEach(async () => {
    await game.scene.ui.setMode(UiMode.MESSAGE);
  });

  async function startBattle() {
    await game.classicMode.startBattle(SpeciesId.FEEBAS);
    game.move.changeMoveset(game.field.getPlayerPokemon(), [MoveId.SPLASH, MoveId.TACKLE]);
  }

  function spyOnCommand() {
    const phase = game.scene.phaseManager.getCurrentPhase() as CommandPhase;
    return vi.spyOn(phase, "handleCommand").mockReturnValue(true);
  }

  describe("Command menu", () => {
    it.each([
      { name: "Fight", x: 225, y: -32, mode: UiMode.FIGHT },
      { name: "Ball", x: 285, y: -32, mode: UiMode.BALL },
      { name: "Pokémon", x: 225, y: -16, mode: UiMode.PARTY },
    ])("should open $name when tapped", async ({ x, y, mode }) => {
      await startBattle();
      expect(game.scene.ui.mode).toBe(UiMode.COMMAND);

      expect(game.scene.ui.processTap(x, y)).toBe(true);
      await vi.waitFor(() => expect(game.scene.ui.mode).toBe(mode));
    });

    it("should run away when Run is tapped", async () => {
      await startBattle();
      const handleCommand = spyOnCommand();

      game.scene.ui.processTap(285, -16);

      expect(handleCommand).toHaveBeenCalledWith(Command.RUN, 0);
    });

    it("should ignore taps outside of the command window", async () => {
      await startBattle();

      expect(game.scene.ui.processTap(100, -32)).toBe(false);
      expect(game.scene.ui.processTap(225, -100)).toBe(false);
      expect(game.scene.ui.mode).toBe(UiMode.COMMAND);
    });
  });

  describe("Move menu", () => {
    async function openMoves() {
      await startBattle();
      game.scene.ui.processTap(225, -32);
      await vi.waitFor(() => expect(game.scene.ui.mode).toBe(UiMode.FIGHT));
    }

    it("should use the tapped move", async () => {
      await openMoves();
      const handleCommand = spyOnCommand();

      expect(game.scene.ui.processTap(150, -32)).toBe(true);

      expect(handleCommand).toHaveBeenCalledWith(Command.FIGHT, 1, MoveUseMode.NORMAL);
    });

    it("should ignore empty move slots and the move details panel", async () => {
      await openMoves();
      const handleCommand = spyOnCommand();

      expect(game.scene.ui.processTap(30, -16)).toBe(false);
      expect(game.scene.ui.processTap(280, -32)).toBe(false);

      expect(handleCommand).not.toHaveBeenCalled();
    });
  });

  describe("Ball menu", () => {
    async function openBalls() {
      await startBattle();
      game.scene.ui.processTap(285, -32);
      await vi.waitFor(() => expect(game.scene.ui.mode).toBe(UiMode.BALL));
      const handler = game.scene.ui.getHandler<BallUiHandler>();
      // Mock text objects do not track their position
      handler["optionsText"].y = -100;
      return handler;
    }

    /** @returns The Y position of the given row of the ball list */
    function ballRowY(handler: BallUiHandler, row: number) {
      return handler["pokeballSelectContainer"].y + handler["optionsText"].y + 7 + row * 16;
    }

    it("should throw the tapped ball", async () => {
      const handler = await openBalls();
      const handleCommand = spyOnCommand();

      game.scene.ui.processTap(handler["pokeballSelectContainer"].x + 30, ballRowY(handler, 0));

      expect(handleCommand).toHaveBeenCalledWith(Command.BALL, 0);
    });

    it("should go back when Cancel is tapped", async () => {
      const handler = await openBalls();
      const cancelRow = Object.keys(game.scene.pokeballCounts).length;

      game.scene.ui.processTap(handler["pokeballSelectContainer"].x + 30, ballRowY(handler, cancelRow));

      await vi.waitFor(() => expect(game.scene.ui.mode).toBe(UiMode.COMMAND));
    });
  });

  describe("Option lists", () => {
    const first = vi.fn(() => true);
    const second = vi.fn(() => true);
    const disabled = vi.fn(() => true);

    async function openOptions() {
      await startBattle();
      first.mockClear();
      second.mockClear();
      disabled.mockClear();
      await game.scene.ui.setMode(UiMode.OPTION_SELECT, {
        options: [
          { label: "First", handler: first },
          { label: "Disabled", handler: disabled, selectable: false },
          { label: "Second", handler: second },
        ],
      });
      const handler = game.scene.ui.getHandler<OptionSelectUiHandler>();
      // Mock objects do not track their size or position
      handler["optionSelectBg"].displayWidth = 60;
      handler["optionSelectContainer"].setPosition(300, 0);
      handler["optionSelectText"].y = -50;
      return handler;
    }

    /** @returns The position of the given row of the option list */
    function rowPosition(handler: OptionSelectUiHandler, row: number) {
      const container = handler["optionSelectContainer"];
      return [container.x - 30, container.y + handler["optionSelectText"].y + 8 + row * 16] as const;
    }

    it("should select the tapped option", async () => {
      const handler = await openOptions();

      expect(game.scene.ui.processTap(...rowPosition(handler, 2))).toBe(true);

      expect(second).toHaveBeenCalledOnce();
      expect(first).not.toHaveBeenCalled();
    });

    it("should ignore unselectable options and taps outside of the list", async () => {
      const handler = await openOptions();
      const [x, y] = rowPosition(handler, 0);

      expect(game.scene.ui.processTap(...rowPosition(handler, 1))).toBe(false);
      expect(game.scene.ui.processTap(...rowPosition(handler, 3))).toBe(false);
      expect(game.scene.ui.processTap(x - 100, y)).toBe(false);

      expect(disabled).not.toHaveBeenCalled();
      expect(first).not.toHaveBeenCalled();
    });

    it("should ignore taps while the list is blocking input", async () => {
      const handler = await openOptions();
      handler["blockInput"] = true;

      expect(game.scene.ui.processTap(...rowPosition(handler, 0))).toBe(false);

      expect(first).not.toHaveBeenCalled();
    });
  });

  describe("Dialogue", () => {
    it("should advance a message waiting for input", async () => {
      await startBattle();
      await game.scene.ui.setMode(UiMode.MESSAGE);
      const handler = game.scene.ui.getMessageHandler();
      const onActionInput = vi.fn();
      handler["awaitingActionInput"] = true;
      handler["onActionInput"] = onActionInput;

      expect(game.scene.ui.processTap(100, -100)).toBe(true);

      expect(onActionInput).toHaveBeenCalledOnce();
    });

    it("should do nothing when no message is waiting for input", async () => {
      await startBattle();
      await game.scene.ui.setMode(UiMode.MESSAGE);
      game.scene.ui.getMessageHandler()["awaitingActionInput"] = false;

      expect(game.scene.ui.processTap(100, -100)).toBe(false);
    });

    it("should advance a tutorial on any screen", async () => {
      await startBattle();
      await game.scene.ui.setMode(UiMode.MESSAGE);
      const handler = game.scene.ui.getMessageHandler();
      const onActionInput = vi.fn();
      handler.tutorialActive = true;
      handler["onActionInput"] = onActionInput;

      expect(game.scene.ui.processTap(100, -100)).toBe(true);

      expect(onActionInput).toHaveBeenCalledOnce();
      handler.tutorialActive = false;
    });
  });

  it("should not pick a reward from a tap, even though the shop awaits action input", async () => {
    await startBattle();
    const handler = game.scene.ui.handlers[UiMode.MODIFIER_SELECT];
    const processInput = vi.spyOn(handler, "processInput");
    handler["awaitingActionInput"] = true;

    expect(handler.processTap(100, -30)).toBe(false);

    expect(processInput).not.toHaveBeenCalled();
  });
});
