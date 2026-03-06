module.exports = {
    apps: [
        {
            name: "job-outreach-pro",
            script: "node_modules/.bin/next",
            args: "start",
            cwd: "/home/ubuntu/job-outreach-pro",
            env: {
                NODE_ENV: "production",
                PORT: 3000,
            },
            instances: 1,
            autorestart: true,
            max_restarts: 10,
            watch: false,
            max_memory_restart: "500M",
        },
    ],
};
