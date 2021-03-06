import fetch from 'node-fetch';
import { MessageEmbed } from 'discord.js';
const tzlookup = require("tz-lookup");

const DIRECTIONS = [
	'north', 'north east',
	'east', 'south east',
	'south', 'south west',
	'west', 'north west'
];

const MOON_PHASES = ['🌑', '🌒️', '🌓', '🌔️', '🌕', '🌖️', '🌗', '🌘️'];

const ICONS = {
	'clear-day': '🌞',
	'clear-night': '🌚',
	'rain': '🌧️',
	'snow': '❄️',
	'sleet': '🌨️',
	'wind': '💨',
	'fog': '🌫️',
	'cloudy': '🌥️',
	'partly-cloudy-day': '⛅',
	'partly-cloudy-night': '⛅'
};

const WEATHER_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const OPENWEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather';
const GEOCODE_URL = 'https://geocode-maps.yandex.ru/1.x/?format=json';

export default async (home_scope: HomeScope) => {
	const { message, args, SECRETS, CONFIG } = home_scope;

	if (args[0] === 'set' && args.length > 1) {
		CONFIG.weather_locations[message.author.id] = args.tail().join(' ');
		return message.answer(`Your weather location has \
			been set to ${args.tail().join(' ')}`.squeeze());
	}

	const location = args[0]
		? args.join(' ')
		: CONFIG.weather_locations[message.author.id] || 'Cuckfield';

	const geokey = SECRETS.yandex.geocoder.key;

	const error = (e: Error) => {
		message.answer(`Error getting weather\n\`\`\`${e.message}\`\`\``);
		return e;
	};

	let geocoder_json, weather_info, geo_object,
		country_code, tz, openweather_info;
	try {
		const geocoder = await fetch(`${GEOCODE_URL}&apikey=${geokey}`
			+`&geocode=${encodeURI(location)}&lang=en-US`);

		geocoder_json = await geocoder.json();
		geo_object = geocoder_json.response
			.GeoObjectCollection
			.featureMember[0].GeoObject;

		country_code = geo_object
			.metaDataProperty
			.GeocoderMetaData
			.Address
			.country_code;

		const [lon, lat] = geo_object.Point.pos.split(' ');
		tz = tzlookup(lat, lon)
		weather_info = await fetch(
			`${WEATHER_URL}?lat=${lat}&lon=${lon}`);
		openweather_info = await fetch(
			`${OPENWEATHER_URL}?lat=${lat}&lon=${lon}`
			+ `&units=metric&appid=${SECRETS.openweather.key}`);
	} catch (e) {
		return error(e);
	}

	const d = await weather_info.json();
	const c = await(openweather_info.json());
	const { properties } = d;
	const temps = [...Array(24)].map((_, n) =>
		properties.timeseries[n].data.instant.details.air_temperature);

	if (!geo_object.name)
		geo_object.name = 'Somewhere';
	if (!geo_object.description)
		geo_object.description = 'Someplace';

	const embed = new MessageEmbed()
		.setTitle(`Cannot get weather information from ${location}.`);

	if (properties && properties.meta) embed
		.setTitle(
			`${properties.timeseries[0].data.instant.details.air_temperature}°C`)
		.setAuthor(`${new Intl.DateTimeFormat('en-CA',
				{ timeZone: tz,
				  timeZoneName: 'short',
				  hour: 'numeric',
				  minute: 'numeric',
				  //year: 'numeric',
				  //month: 'numeric',
				  //day: 'numeric',
				  hour12: false })
					.format(new Date)},`
			+ ` ${geo_object.name},`
			+ ` ${geo_object.description}`,
			`https://www.countryflags.io/${country_code}/shiny/64.png`)
		.setThumbnail(
			`https://api.met.no/images/weathericons/png/${properties.timeseries[0].data.next_1_hours.summary.symbol_code}.png`)
		.addFields(
			{ name: 'daytime',
			  value: c.main.temp_max + '°C',
			  inline: true },
			{ name: 'nighttime',
			  value: c.main.temp_min + '°C',
			  inline: true },
			{ name: 'humidity',
			  value: properties.timeseries[0].data.instant.details.relative_humidity + '%',
			  inline: true },
			{ name: 'wind',
			  value: `${DIRECTIONS[Math.round(properties.timeseries[0].data.instant.details.wind_from_direction / 45) % 8]}`
				+ ` ${properties.timeseries[0].data.instant.details.wind_speed} ㎧`,
			  inline: true })
		.setFooter(
			'Data provided by Meteorologisk institutt (met.no) and OpenWeatherMap',
			'https://0x0.st/ixd6.png');

	message.channel.send(embed);
};
