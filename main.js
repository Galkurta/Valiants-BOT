const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
const { DateTime } = require('luxon');
const colors = require('colors');

class ValiantAPI {
    constructor(token) {
        this.token = token;
        this.headers = {
            'accept': '*/*',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'authorization': `Bearer ${token}`,
            'content-type': 'application/json',
            'origin': 'https://mini.playvaliants.com',
            'referer': 'https://mini.playvaliants.com/',
            'sec-ch-ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36',
            'x-pinggy-no-screen': 'true'
        };
    }

    async getData() {
        return this.http('https://mini.playvaliants.com/api/user/data');
    }

    async claimDailyReward() {
        return this.http('https://mini.playvaliants.com/api/rewards/claim', 'post');
    }

    async getMission() {
        return this.http('https://mini.playvaliants.com/api/user/missions');
    }

    async claimMission(payload) {
        return this.http('https://mini.playvaliants.com/api/missions/claim', 'post', payload);
    }

    async taptap(payload) {
        return this.http('https://mini.playvaliants.com/api/gameplay/click', 'post', payload);
    }

    async upgradeEnergy() {
        return this.http('https://mini.playvaliants.com/api/perks/energy-level-up', 'post', {});
    }

    async upgradeMultitap() {
        return this.http('https://mini.playvaliants.com/api/perks/click-level-up', 'post', {});
    }

    async http(url, method = 'get', data = {}) {
        try {
            const response = await axios({ url, method, headers: this.headers, data });
            return response.data;
        } catch (error) {
            if (error.response) {
                const { status, data } = error.response;
                if (status === 400 && data.message.startsWith('Not enough experience')) {
                    this.log('Balance is not enough!'.red);
                } else {
                    this.log(`Error: ${status} ${error.response.statusText}`.red);
                }
            } else {
                this.log(`Error: ${error.message}`.red);
            }
            return null;
        }
    }
    

    log(msg, type = 'info') {
        const colorMap = {
            info: 'green',
            success: 'cyan',
            warning: 'yellow',
            error: 'red',
            default: 'white'
        };
        const color = colorMap[type] || colorMap.default;
        console.log(`[*] ${msg}`[color]);
    }

    async getConfig() {
        return this.http('https://mini.playvaliants.com/api/gameplay/config');
    }

    async unlock(id) {
        return this.http('https://mini.playvaliants.com/api/unlock', 'post', { id });
    }

}

async function waitWithCountdown(delay) {
    for (let i = delay; i >= 0; i--) {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`===== Completed all accounts, waiting ${i} seconds to continue the loop =====`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('');
}

const loadCredentials = () => {
    try {
        const data = fs.readFileSync('data.txt', 'utf-8');
        return data.split('\n').map(line => line.trim());
    } catch (err) {
        console.error("File data.txt not found or an error occurred:".red, err);
        return [];
    }
};

const main = async () => {
    const queries = loadCredentials();
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const mission = await new Promise(resolve => rl.question("Do you want to automatically do the task? (y/n): ", resolve));
    const upteam = await new Promise(resolve => rl.question("Do you want to automatically buy a card (team)? (y/n): ", resolve));
    const autoUpdate = await new Promise(resolve => rl.question("Do you want to automatically upgrade? (y/n): ", resolve));

    let maxLevel = 0;
    if (autoUpdate === 'y') {
        maxLevel = await new Promise(resolve => rl.question("LV maximum want to upgrade: ", resolve));
        maxLevel = parseInt(maxLevel, 10);
    }
    rl.close();

    while (true) {
        for (const [index, token] of queries.entries()) {
            const api = new ValiantAPI(token);
            const dataLogin = await api.getData();

            if (dataLogin) {
                api.log(`\n========== Account ${index + 1} ==========`.blue);
                let { energy, energy_level, click_level, energy_cap, daily_reward, experience, experience_per_hour } = dataLogin;
                api.log(`Balance: ${experience}`, 'info');
                api.log(`Exp per Hour: ${experience_per_hour}/Hour`, 'info');
                api.log(`Energy: ${energy}/${energy_cap}`, 'info');

                if (!daily_reward.claimed) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const dailyData = await api.claimDailyReward();
                    if (dailyData) {
                        api.log(`Having successfully attended the day ${dailyData.day} | Reward: ${dailyData.reward}`, 'success');
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } else {
                    api.log('Today you have attended!'.yellow, 'warning');
                }
                if (upteam === 'y') {
                    const configData = await api.getConfig();
                    if (configData && configData.unlocks) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        for (const id of Object.keys(configData.unlocks)) {
                            const unlockData = await api.unlock(parseInt(id, 10));
                            if (unlockData) {
                                api.log(`Open ID card ${id} Success`, 'success');
                            } else {
                                api.log(`Open ID card ${id} failure`, 'error');
                            }
                            await new Promise(resolve => setTimeout(resolve, 3000));
                        }                    
                    }
                }                

                if (autoUpdate === 'y') {
                    if (energy_level < maxLevel) {
                        api.log("Maximum energy upgrade...", 'info');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const upgradeData = await api.upgradeEnergy();
                        if (upgradeData) {
                            api.log(`Energy is upgraded to LV ${upgradeData.energy_level}`, 'success');
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    if (click_level < maxLevel) {
                        api.log("Upgrade Multitap...", 'info');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const upgradeData = await api.upgradeMultitap();
                        if (upgradeData) {
                            api.log(`Multi was successfully upgraded ${upgradeData.click_level}`, 'success');
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                if (mission === 'y') {
                    const missionData = await api.getMission();
                    if (missionData) {
                        for (const mission of missionData.missions) {
                            if (mission.type === 'referral') continue;
                            if (!mission.claimed) {
                                await new Promise(resolve => setTimeout(resolve, 2000));
                                const payload = { id: mission.id };
                                const claimData = await api.claimMission(payload);
                                if (claimData) {
                                    api.log(`Do the misson ${mission.id} success | Reward: ${claimData.reward}`, 'success');
                                }
                            }
                        }
                    }
                }

                while (true) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const tap = Math.min(randomInt(50, 60), energy);
                    const tapData = await api.taptap({ count: tap });
                
                    if (tapData) {
                        const { user_energy, reward } = tapData;
                        api.log(`Tap okay ${reward} Time, energy still: ${user_energy}`, 'success');
                        energy = user_energy;
                    } else {
                        api.log('Unable get data!'.red, 'error');
                        break;
                    }
                
                    if (energy < 50) {
                        api.log('Energy below 50, stop tap for this account.', 'warning');
                        break;
                    }
                }
            }
        }
        const delay = randomInt(300, 500);
        await waitWithCountdown(delay);
    }
};

const randomInt = (min, max) => Math.floor(Math.random() * (min + (max - min + 1)));

main().catch(err => console.error(err.red));