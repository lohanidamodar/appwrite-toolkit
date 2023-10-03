const inquirer = require("inquirer");
const { Users, Teams } = require("node-appwrite");
const ProgressBar = require("progress");
const { faker } = require("@faker-js/faker");

function appendRandomNumberToEmail(email) {
  const randomNumber = Math.floor(Math.random() * 1000000000000); // Generates a 12-digit random number
  const atIndex = email.indexOf('@');
  
  if (atIndex !== -1) {
    const modifiedEmail = email.slice(0, atIndex) + randomNumber + email.slice(atIndex);
    return modifiedEmail;
  } else {
    // Handle invalid email format
    return email;
  }
}

async function generateUsers(appwrite) {
  const userClient = new Users(appwrite);

  const { usersNo } = await inquirer.prompt([
    {
      type: "number",
      name: "usersNo",
      message: "How many fake users would you like to generate?",
    },
  ]);

  const users = [];

  const bar = new ProgressBar("Creating new users... [:bar] :current/:total", {
    total: usersNo,
  });

  for (let i = 0; i < usersNo; i += 1) {
    const number =
      Math.random() < 0.5 ? faker.phone.number("+44071########") : null;

    const user = {
      email: faker.internet.email(),
      emailVerified: Math.random() < 0.5,
      password: faker.internet.password(),
      displayName: `${faker.person.firstName()} ${faker.person.lastName()}`,
      photoURL: faker.image.avatar(),
      disabled: Math.random() < 0.5,
    };

    if (number) {
      user.phoneNumber = number;
    }

    try {
      const appwriteUser = await userClient
      .create(
        "unique()",
        appendRandomNumberToEmail(user.email),
        user.phoneNumber || null,
        user.password,
        user.displayName
      )
      .then((response) => {
        users.push(response);
        bar.tick();

        return response;
      });

      userClient.updateEmailVerification(appwriteUser.$id, user.emailVerified);
    } catch (error) {
      if (error.type === "user_already_exists") {
        console.log(user);
        continue;
      } else {
        throw error;
      }
    }

    if (i % 100 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Give Appwrite a moment to catch up
    }
  }

  return users;
}

async function generateTeams(appwrite, users) {
  const teamsClient = new Teams(appwrite);

  const { teamsNo } = await inquirer.prompt([
    {
      type: "number",
      name: "teamsNo",
      message: "How many fake teams would you like to generate?",
    },
  ]);

  // Waiting for new SDK release
  let { randomlyAssignUsers } = await inquirer.prompt([
    {
      type: "confirm",
      name: "randomlyAssignUsers",
      message: "Would you like to randomly assign users to teams?",
    },
  ]);

  const teams = [];

  let bar = new ProgressBar("Creating new teams... [:bar] :current/:total", {
    total: teamsNo,
  });

  for (let i = 0; i < teamsNo; i += 1) {
    await teamsClient
      .create("unique()", faker.company.name())
      .then((response) => {
        teams.push(response);
        bar.tick();
      });
  }

  if (randomlyAssignUsers) {
    bar = new ProgressBar(
      "Assigning users to teams... [:bar] :current/:total",
      { total: users.length }
    );

    const teamAssignPromises = users.map(async (user) => {
      const team = teams[Math.floor(Math.random() * teams.length)];

      await teamsClient
        .createMembership(team.$id, ["owner"], 'http://localhost', undefined, user.$id)
        .then(() => {
          bar.tick();
        });
    });

    await Promise.all(teamAssignPromises);
  }

  return teams;
}

async function handleAuth(appwrite) {
  const users = await generateUsers(appwrite);

  if (!users.length) {
    return {};
  }

  const teams = await generateTeams(appwrite, users);

  return { users, teams };
}

module.exports = {
  handleAuth,
};
