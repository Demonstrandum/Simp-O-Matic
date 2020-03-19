import { execFileSync } from 'child_process'
export default home_scope => {
	const { message, args } = home_scope
	message.answer('``` \n' + execFileSync('/bin/figlet', args) + '```', {encoding: 'utf8'}) // this is safe because no shell is spawned
}