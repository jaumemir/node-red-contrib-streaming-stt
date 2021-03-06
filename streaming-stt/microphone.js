'use strict'
const isMac = require('os').type() == 'Darwin';
const isWin = require('os').type().indexOf('Windows') > -1;
const spawn = require('child_process').spawn;
const EventEmitter = require('events');

class Microphone extends EventEmitter {
    constructor(options) {
        super();
        this.ps = null;

        options = options || {};
        this.endian = options.endian || 'little';
        this.bitwidth = options.bitwidth || '16';
        this.encoding = options.encoding || 'signed-integer';
        this.rate = options.rate || '16000';
        this.channels = options.channels || '1';
        this.command = options.command || '';

        if (!isWin && !isMac) {
            this.device = options.device || 'plughw:1,0';
            this.format = undefined;
            this.formatEndian = undefined;
            this.formatEncoding = undefined;

            if (this.encoding === 'unsigned-integer') {
                this.formatEncoding = 'U';
            } else {
                this.formatEncoding = 'S';
            }
            if (this.endian === 'big') {
                this.formatEndian = 'BE';
            } else {
                this.formatEndian = 'LE';
            }
            this.format = this.formatEncoding + this.bitwidth + '_' + this.formatEndian;
        }


    }

    startRecording() {
        if (this.ps === null) {
            if (this.command !== '') {
                var parts = this.command.split(' ');
                var cmd = parts[0];
                var args = parts.slice(1);
                console.log('Running custom command '+cmd+' ['+args+']');
                this.ps = spawn(cmd, args);
            } else if (isWin) {
                this.ps = spawn('sox', ['-b', this.bitwidth, '--endian', this.endian, '-c', this.channels, '-r', this.rate, '-e', this.encoding, '-t', 'waveaudio', 'default', '-p']);
            } else if (isMac) {
                this.ps = spawn('rec', ['-q', '-b', this.bitwidth, '-c', this.channels, '-r', this.rate, '-e', this.encoding, '-t', 'wav', '-']);  
            } else {
                this.ps = spawn('arecord', ['-c', this.channels, '-r', this.rate, '-f', this.format, '-D', this.device]);
            }
            this.ps.on('error', (error) => {
                this.emit('error', error);
            });
            this.ps.stderr.on('error', (error) => {
                this.emit('error', error);
            });
            this.ps.stderr.on('data', (info) => {
                this.emit('info', info);
            })
            return this.ps.stdout;
           
        }
    }

    stopRecording() {
        if (this.ps) {
            this.ps.kill();
            this.ps = null;
        }
    }
}

module.exports = Microphone;
