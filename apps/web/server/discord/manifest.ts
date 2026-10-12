/** Limits from https://docs.discord.com/developers/interactions/receiving-and-responding and /components/reference. */
export const discordLimits = {
  content: 2000,
  choices: 25,
  choiceName: 100,
  modalTitle: 45,
  modalFields: 5,
  label: 45,
  text: 4000,
  customId: 100,
  buttons: 5,
  buttonLabel: 80,
  checkboxOptions: 10,
} as const;

/** Guild-only daily-loop commands; registration uses this same manifest. */
export const guildCommands = [
  { name: "dashboard", description: "Your private progress and next action" },
  {
    name: "report",
    description: "Write or edit today's private report",
    options: [
      {
        type: 3,
        name: "season",
        description:
          "Choose a season when you have more than one active attempt",
        autocomplete: true,
      },
    ],
  },
  { name: "seasons", description: "Browse published seasons" },
  {
    name: "join",
    description: "Join a season by name",
    options: [
      {
        type: 3,
        name: "season",
        description: "Choose a published season",
        required: true,
        autocomplete: true,
      },
    ],
  },
  {
    name: "help",
    description: "How to practise, report and manage your account",
  },
].map((command) => ({
  ...command,
  type: 1,
  contexts: [0],
  integration_types: [0],
}));
