
npm install .
node app.js > /dev/null 2>&1 &
NODE_PID=$!
echo Example running as pid $NODE_PID
sleep 1
../../node_modules/hopjs-remote/bin/hopjs --url http://localhost:3000/api/ --unitTest
EXIT=$?

kill $NODE_PID

exit $EXIT




