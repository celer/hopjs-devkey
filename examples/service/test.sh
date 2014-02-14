
npm install .
node exampleservice.js > /dev/null 2>&1 &
EX_PID=$!
node devkeyserver.js > /dev/null 2>&1 &
DK_PID=$!
echo Example running as pid $EX_PID
echo Running devkey server as pid $DK_PID
sleep 1
../../node_modules/hopjs-remote/bin/hopjs --url http://localhost:3000/api/ --unitTest
EXIT=$?

kill $EX_PID
kill $DK_PID

exit $EXIT




