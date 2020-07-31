import {app} from "./app";


if (process.env.START_SERVER === 'true') {
  app.listen(process.env.SERVER_PORT , async () => {
    console.log('Listening on port 3000')
  })

  process.on('exit', async () => {
    console.log('index.ts received exit event')
  })
}