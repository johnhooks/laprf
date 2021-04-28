/**
 * Copyright (C) 2021 copyright-holder John Hooks <bitmachina@outlook.com>
 * This file is part of @fpvcult/laprf.
 *
 * @fpvcult/laprf is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * @fpvcult/laprf is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with @fpvcult/laprf.  If not, see <https://www.gnu.org/licenses/>.
 *
 */

import type { DeviceRecord, RfSetupSlotInput, Maybe } from './types';
import { Encoder } from './Encoder';
import { Decoder } from './Decoder';
import { Frequency } from './Frequency';
import { u8, u16, u32, f32 } from './Numbers';
import { RecordType, RfSetupField, SettingsField, TimeField, ErrorCode, EOR, SOR } from './const';
import { splitRecords, unescape } from './helpers';

export class Protocol {
  static DEBUG = false;

  static SOR = SOR;
  static EOR = EOR;

  /**
   * Serialize a LapRF packet to request the `rtcTime`.
   *
   * Requesting `rtcTime' requires an irregular packet.
   * @static
   * @returns {Uint8Array} An encoded packet to request `rtcTime'.
   */
  static getRtcTime(): Uint8Array {
    return new Encoder(RecordType.time)
      .write(u8, TimeField.rtcTime) // `rtcTime`
      .write(u8, 0x00)
      .finishRecord();
  }

  /**
   * Serialize a LapRF packet to get the `minLapTime`.
   * @returns {Uint8Array} An encoded packet to request `minLapTime'.
   */
  static getMinLapTime(): Uint8Array {
    return new Encoder(RecordType.settings)
      .encodeField(SettingsField.minLapTime, u32, 0x00)
      .finishRecord();
  }

  /**
   * Serialize a LapRF packet to set the `minLapTime`.
   * @param {number} milliseconds The number of milliseconds to set as the minimum lap time.
   * @returns {Uint8Array} An encoded packet to set `minLapTime'.
   */
  static setMinLapTime(milliseconds: number): Uint8Array {
    return new Encoder(RecordType.settings)
      .encodeField(SettingsField.minLapTime, u32, milliseconds)
      .finishRecord();
  }

  /**
   * Serialize a LapRF packet to get the `statusInterval`.
   * ISSUE: Requesting the status interval does not work.
   * @returns {Uint8Array} An encoded packet to request `statusInterval'.
   */
  // static getStatusInterval(): Uint8Array {
  //   return new Encoder(RecordType.settings)
  //     .encodeField(SettingsField.statusInterval, u16, 0x00)
  //     .finishRecord();
  // }

  /**
   * Serialize a LapRF packet to set the `statusInterval`.
   * @param {number} milliseconds The number of milliseconds to use as the status interval.
   * @returns {Uint8Array} An encoded packet to set `statusInterval'.
   */
  static setStatusInterval(milliseconds: number): Uint8Array {
    return new Encoder(RecordType.settings)
      .encodeField(SettingsField.statusInterval, u16, milliseconds)
      .finishRecord();
  }

  /**
   * Serialize a LapRF packet to request the `rfSetup`.
   * @param {number} [slotIndex] Optionally request only a single slot.
   * @returns {Uint8Array} An encoded packet to request `rfSetup'.
   */
  static getRfSetup(slotIndex?: number): Uint8Array {
    const record = new Encoder(RecordType.rfSetup);
    if (typeof slotIndex === 'number') {
      record.encodeField(RfSetupField.slotIndex, u8, slotIndex);
    } else {
      for (let i = 1; i <= 8; i++) {
        record.encodeField(RfSetupField.slotIndex, u8, i);
      }
    }
    return record.finishRecord();
  }

  /**
   * Serialize a LapRF packet to set a `rfSetup` slot.
   * @param {RfSetupSlotInput} settings The options to configure the slot.
   * @returns {Uint8Array} An encoded packet to set a `rfSetup' slot.
   */
  static setRfSetup({
    slotId,
    channelName,
    gain = 51,
    threshold = 900,
    enabled = true,
  }: RfSetupSlotInput): Uint8Array {
    const channel = Frequency.get(channelName);

    if (!channel) {
      throw new Error(`[LapRF Error] ${ErrorCode.InvalidChannelName} Invalid channel name`);
    }

    return new Encoder(RecordType.rfSetup)
      .encodeField(RfSetupField.slotIndex, u8, slotId)
      .encodeField(RfSetupField.enabled, u16, enabled ? 1 : 0)
      .encodeField(RfSetupField.channel, u16, channel.channel)
      .encodeField(RfSetupField.band, u16, channel.band)
      .encodeField(RfSetupField.threshold, f32, threshold)
      .encodeField(RfSetupField.gain, u16, gain)
      .encodeField(RfSetupField.frequency, u16, channel.frequency)
      .finishRecord();
  }

  /**
   * Deserialize a LapRF Packet.
   * @param {DataView} buffer The raw LapRF packet to deserialize.
   * @returns {DeviceRecord[]} The deserialized records.
   */
  static decode(buffer: DataView): DeviceRecord[] {
    const records: DeviceRecord[] = [];
    const buffers = splitRecords(buffer);

    for (const buffer of buffers) {
      try {
        const record = new Decoder(buffer, Protocol.DEBUG).decode();
        if (record) records.push(record);
      } catch (error) {
        if (Protocol.DEBUG) {
          console.error(error);
        }
      }
    }

    return records;
  }

  /**
   * Deserialize a LapRF record.
   * @param {DataView} buffer An unescaped LapRF record to deserialize.
   * @returns {DeviceRecord | undefined} The deserialized record.
   */
  static decodeRecord(buffer: DataView): Maybe<DeviceRecord> {
    return new Decoder(buffer, Protocol.DEBUG).decode();
  }

  /**
   * Unescaped a LapRF record.
   * @param {Uint8Array} input Raw record received from a LapRF.
   * @returns {DataView} The `input` with content unescaped.
   */
  static unescape(input: Uint8Array): DataView {
    return unescape(input);
  }
}
